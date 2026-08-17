package com.thrisual.backend.controllers;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@RestController
@RequestMapping("/api/public")
public class HomeController {

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "service", "Thrisual Smart Teach API");
    }
}
