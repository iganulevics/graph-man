package com.graphman.model;

import java.time.Instant;
import java.util.UUID;

public class SavedRequest extends GraphQLRequest {

    private String id;
    private String name;
    private Instant createdAt;
    private Instant updatedAt;

    public SavedRequest() {
        this.id = UUID.randomUUID().toString();
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public static SavedRequest fromRequest(GraphQLRequest request, String name) {
        SavedRequest saved = new SavedRequest();
        saved.setName(name);
        saved.setUrl(request.getUrl());
        saved.setHeaders(request.getHeaders());
        saved.setAuth(request.getAuth());
        saved.setQuery(request.getQuery());
        saved.setVariables(request.getVariables());
        return saved;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
