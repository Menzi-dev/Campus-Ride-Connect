package com.campusconnect.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/test")
public class TestController {

    @GetMapping("/connection")
    public ResponseEntity<Map<String, String>> connection() {
        return ResponseEntity.ok(Map.of("status", "CONNECTED"));
    }
}
