package com.graphman.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.graphman.model.AuthConfig;
import com.graphman.model.GraphQLRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Base64;
import java.util.Map;

@Service
public class GraphQLService {

    private static final Logger log = LoggerFactory.getLogger(GraphQLService.class);

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;

    public GraphQLService(WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.webClientBuilder = webClientBuilder;
        this.objectMapper = objectMapper;
    }

    public Mono<JsonNode> executeQuery(GraphQLRequest request) {
        log.debug("Executing GraphQL query to: {}", request.getUrl());

        ObjectNode body = objectMapper.createObjectNode();
        body.put("query", request.getQuery());

        if (request.getVariables() != null && !request.getVariables().isBlank()) {
            try {
                JsonNode variables = objectMapper.readTree(request.getVariables());
                body.set("variables", variables);
            } catch (Exception e) {
                log.warn("Failed to parse variables as JSON: {}", e.getMessage());
            }
        }

        WebClient.RequestBodySpec spec = webClientBuilder.build()
                .post()
                .uri(request.getUrl())
                .header("Content-Type", "application/json");

        // Add custom headers
        for (Map.Entry<String, String> header : request.getHeaders().entrySet()) {
            spec = spec.header(header.getKey(), header.getValue());
        }

        // Add authentication
        spec = applyAuth(spec, request.getAuth());

        return spec.bodyValue(body)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .onErrorResume(e -> {
                    log.error("GraphQL request failed: {}", e.getMessage());
                    ObjectNode error = objectMapper.createObjectNode();
                    error.put("error", e.getMessage());
                    return Mono.just(error);
                });
    }

    private WebClient.RequestBodySpec applyAuth(WebClient.RequestBodySpec spec, AuthConfig auth) {
        if (auth == null || auth.getType() == null) {
            return spec;
        }

        switch (auth.getType()) {
            case BEARER_TOKEN:
                if (auth.getBearerToken() != null && !auth.getBearerToken().isBlank()) {
                    spec = spec.header("Authorization", "Bearer " + auth.getBearerToken());
                }
                break;
            case BASIC_AUTH:
                if (auth.getBasicUsername() != null && auth.getBasicPassword() != null) {
                    String credentials = auth.getBasicUsername() + ":" + auth.getBasicPassword();
                    String encoded = Base64.getEncoder().encodeToString(credentials.getBytes());
                    spec = spec.header("Authorization", "Basic " + encoded);
                }
                break;
            case API_KEY:
                if (auth.getApiKeyHeader() != null && auth.getApiKeyValue() != null) {
                    spec = spec.header(auth.getApiKeyHeader(), auth.getApiKeyValue());
                }
                break;
            default:
                break;
        }

        return spec;
    }
}
