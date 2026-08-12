package com.campusconnect.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/test")
public class TestController {

    private final JdbcTemplate jdbcTemplate;

    public TestController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/connection")
    public ResponseEntity<Map<String, Object>> testConnection() {
        Map<String, Object> result = new HashMap<>();
        Object database = jdbcTemplate.queryForObject("SELECT DATABASE()", Object.class);
        result.put("status", "OK");
        result.put("message", "Backend connected to MySQL successfully");
        result.put("database", database);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/hello")
    public ResponseEntity<Map<String, Object>> hello(HttpServletRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        Map<String, Object> result = new HashMap<>();
        result.put("hello", "Hello from CampusConnect backend");
        result.put("authenticated", authentication != null && authentication.isAuthenticated());
        if (authentication != null) {
            result.put("principal", authentication.getPrincipal());
            result.put("authorities", authentication.getAuthorities().stream()
                    .map(GrantedAuthority::getAuthority)
                    .collect(Collectors.toList()));
            result.put("details", authentication.getDetails());
            result.put("name", authentication.getName());
        }
        return ResponseEntity.ok(result);
    }
}
