package com.graphman.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.graphman.model.GraphQLRequest;
import com.graphman.model.GraphQLSchema;
import com.graphman.service.GraphQLService;
import com.graphman.service.IntrospectionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/graphql")
public class GraphQLController {

    private final GraphQLService graphQLService;
    private final IntrospectionService introspectionService;

    public GraphQLController(GraphQLService graphQLService, IntrospectionService introspectionService) {
        this.graphQLService = graphQLService;
        this.introspectionService = introspectionService;
    }

    @PostMapping("/execute")
    public Mono<ResponseEntity<JsonNode>> execute(@RequestBody GraphQLRequest request) {
        return graphQLService.executeQuery(request)
                .map(ResponseEntity::ok)
                .onErrorReturn(ResponseEntity.internalServerError().build());
    }

    @PostMapping("/introspect")
    public Mono<ResponseEntity<GraphQLSchema>> introspect(@RequestBody GraphQLRequest request) {
        return introspectionService.introspect(request)
                .map(ResponseEntity::ok)
                .onErrorReturn(ResponseEntity.internalServerError().build());
    }

    @PostMapping("/introspect/raw")
    public Mono<ResponseEntity<JsonNode>> introspectRaw(@RequestBody GraphQLRequest request) {
        return introspectionService.introspectRaw(request)
                .map(ResponseEntity::ok)
                .onErrorReturn(ResponseEntity.internalServerError().build());
    }
}
