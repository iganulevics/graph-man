package com.graphman.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.util.List;

@Service
public class ShopifyAIService {

    private static final Logger log = LoggerFactory.getLogger(ShopifyAIService.class);

    @Value("${shopify.ai.url:https://shopify.dev/assistant/conversations}")
    private String shopifyAiUrl;

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;

    public ShopifyAIService(WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.webClientBuilder = webClientBuilder;
        this.objectMapper = objectMapper;
    }

    public Flux<ServerSentEvent<String>> chat(String prompt, List<String> promptHistory) {
        log.debug("Sending chat request to Shopify AI: {}", prompt);

        ObjectNode requestBody = objectMapper.createObjectNode();
        requestBody.put("prompt", prompt);

        ArrayNode historyArray = objectMapper.createArrayNode();
        if (promptHistory != null) {
            promptHistory.forEach(historyArray::add);
        }
        requestBody.set("prompt_history", historyArray);

        // Get raw response and parse SSE manually for full control
        return webClientBuilder
                .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(16 * 1024 * 1024))
                .build()
                .post()
                .uri(shopifyAiUrl)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToFlux(String.class)
                .flatMap(this::parseRawSSE)
                .map(text -> {
                    // JSON-encode the text to preserve newlines and special characters
                    // The client will JSON.parse to decode
                    try {
                        String jsonEncoded = objectMapper.writeValueAsString(text);
                        return ServerSentEvent.<String>builder()
                                .data(jsonEncoded)
                                .build();
                    } catch (JsonProcessingException e) {
                        log.error("Failed to JSON encode text: {}", e.getMessage());
                        return ServerSentEvent.<String>builder()
                                .data(text)
                                .build();
                    }
                })
                .onErrorResume(e -> {
                    log.error("Shopify AI request failed: {}", e.getMessage());
                    return Flux.just(ServerSentEvent.<String>builder()
                            .event("error")
                            .data("Error: " + e.getMessage())
                            .build());
                });
    }

    private Flux<String> parseRawSSE(String rawChunk) {
        if (rawChunk == null || rawChunk.isBlank()) {
            return Flux.empty();
        }

        // Spring WebFlux already parses SSE and gives us the data values directly
        // The chunks are JSON-encoded strings like "To" or " fetch" (with quotes)
        try {
            String text = objectMapper.readValue(rawChunk, String.class);
            if (text != null && !text.isEmpty()) {
                log.debug("Parsed text token: [{}]", text);
                return Flux.just(text);
            }
        } catch (JsonProcessingException e) {
            // If it's not a JSON string, check if it's a JSON object (tool call, metadata)
            // Skip those - they're internal Shopify AI data
            if (rawChunk.trim().startsWith("{")) {
                log.debug("Skipping JSON object: {}", rawChunk.length() > 100 ? rawChunk.substring(0, 100) + "..." : rawChunk);
                return Flux.empty();
            }
            // Otherwise it might be raw text - return as-is
            log.debug("Using as raw text: {}", rawChunk);
            if (!rawChunk.isBlank()) {
                return Flux.just(rawChunk);
            }
        }

        return Flux.empty();
    }
}
