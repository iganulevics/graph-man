package com.graphman.controller;

import com.graphman.service.ShopifyAIService;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ShopifyAIService shopifyAIService;

    public ChatController(ShopifyAIService shopifyAIService) {
        this.shopifyAIService = shopifyAIService;
    }

    @PostMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> chat(@RequestBody Map<String, Object> request) {
        String prompt = (String) request.get("prompt");

        @SuppressWarnings("unchecked")
        List<String> promptHistory = (List<String>) request.getOrDefault("prompt_history", List.of());

        return shopifyAIService.chat(prompt, promptHistory);
    }
}
