package com.graphman.controller;

import com.graphman.model.SavedRequest;
import com.graphman.service.RequestStorageService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/requests")
public class RequestController {

    private final RequestStorageService storageService;

    public RequestController(RequestStorageService storageService) {
        this.storageService = storageService;
    }

    @GetMapping
    public ResponseEntity<List<SavedRequest>> listAll() {
        return ResponseEntity.ok(storageService.listAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<SavedRequest> getById(@PathVariable String id) {
        return storageService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<SavedRequest> save(@RequestBody SavedRequest request) {
        try {
            SavedRequest saved = storageService.save(request);
            return ResponseEntity.ok(saved);
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<SavedRequest> update(@PathVariable String id, @RequestBody SavedRequest request) {
        request.setId(id);
        try {
            SavedRequest saved = storageService.save(request);
            return ResponseEntity.ok(saved);
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        boolean deleted = storageService.delete(id);
        return deleted ? ResponseEntity.ok().build() : ResponseEntity.notFound().build();
    }
}
