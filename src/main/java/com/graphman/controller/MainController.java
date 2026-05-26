package com.graphman.controller;

import com.graphman.model.SavedRequest;
import com.graphman.service.RequestStorageService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.List;

@Controller
public class MainController {

    private final RequestStorageService storageService;

    public MainController(RequestStorageService storageService) {
        this.storageService = storageService;
    }

    @GetMapping("/")
    public String index(Model model) {
        List<SavedRequest> savedRequests = storageService.listAll();
        model.addAttribute("savedRequests", savedRequests);
        return "index";
    }
}
