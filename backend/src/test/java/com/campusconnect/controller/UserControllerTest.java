package com.campusconnect.controller;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class UserControllerTest {

    @Test
    void getAllUsersReturnsUsersFromDatabase() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForList(anyString())).thenReturn(List.of(
            Map.of("id", 1, "full_name", "Alice Example", "email", "alice@example.com", "role", "student")
        ));

        UserController controller = new UserController(jdbcTemplate);

        ResponseEntity<List<Map<String, Object>>> response = controller.getAllUsers();

        assertEquals(200, response.getStatusCode().value());
        assertEquals(1, response.getBody().size());
        assertEquals("Alice Example", response.getBody().get(0).get("fullName"));
        assertEquals("alice@example.com", response.getBody().get(0).get("email"));
    }
}
