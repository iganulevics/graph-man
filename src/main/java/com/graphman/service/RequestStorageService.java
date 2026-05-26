package com.graphman.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.graphman.model.SavedRequest;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

@Service
public class RequestStorageService {

    private static final Logger log = LoggerFactory.getLogger(RequestStorageService.class);

    @Value("${graphman.storage.path:saved-requests}")
    private String storagePath;

    private final ObjectMapper objectMapper;
    private Path storageDirectory;

    public RequestStorageService() {
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
        this.objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        this.objectMapper.enable(SerializationFeature.INDENT_OUTPUT);
    }

    @PostConstruct
    public void init() throws IOException {
        this.storageDirectory = Paths.get(storagePath).toAbsolutePath();
        if (!Files.exists(storageDirectory)) {
            Files.createDirectories(storageDirectory);
            log.info("Created storage directory: {}", storageDirectory);
        }
    }

    public List<SavedRequest> listAll() {
        List<SavedRequest> requests = new ArrayList<>();

        try (Stream<Path> files = Files.list(storageDirectory)) {
            files.filter(path -> path.toString().endsWith(".json"))
                    .forEach(path -> {
                        try {
                            SavedRequest request = objectMapper.readValue(path.toFile(), SavedRequest.class);
                            requests.add(request);
                        } catch (IOException e) {
                            log.warn("Failed to read request file: {}", path, e);
                        }
                    });
        } catch (IOException e) {
            log.error("Failed to list saved requests", e);
        }

        // Sort by updated time, newest first
        requests.sort(Comparator.comparing(SavedRequest::getUpdatedAt).reversed());

        return requests;
    }

    public Optional<SavedRequest> getById(String id) {
        Path filePath = storageDirectory.resolve(id + ".json");

        if (!Files.exists(filePath)) {
            return Optional.empty();
        }

        try {
            SavedRequest request = objectMapper.readValue(filePath.toFile(), SavedRequest.class);
            return Optional.of(request);
        } catch (IOException e) {
            log.error("Failed to read request: {}", id, e);
            return Optional.empty();
        }
    }

    public SavedRequest save(SavedRequest request) throws IOException {
        if (request.getId() == null || request.getId().isBlank()) {
            throw new IllegalArgumentException("Request must have an ID");
        }

        request.setUpdatedAt(Instant.now());

        Path filePath = storageDirectory.resolve(request.getId() + ".json");
        objectMapper.writeValue(filePath.toFile(), request);

        log.info("Saved request: {} ({})", request.getName(), request.getId());

        return request;
    }

    public boolean delete(String id) {
        Path filePath = storageDirectory.resolve(id + ".json");

        try {
            boolean deleted = Files.deleteIfExists(filePath);
            if (deleted) {
                log.info("Deleted request: {}", id);
            }
            return deleted;
        } catch (IOException e) {
            log.error("Failed to delete request: {}", id, e);
            return false;
        }
    }
}
