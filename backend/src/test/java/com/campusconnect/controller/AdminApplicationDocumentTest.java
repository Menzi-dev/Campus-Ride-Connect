package com.campusconnect.controller;

import com.campusconnect.entity.Driver;
import com.campusconnect.entity.User;
import com.campusconnect.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AdminApplicationDocumentTest {
    private final UserRepository users = mock(UserRepository.class);
    private final DriverRepository drivers = mock(DriverRepository.class);
    private final AdminController controller = new AdminController(users, mock(RideRepository.class), drivers, mock(JdbcTemplate.class), mock(com.campusconnect.service.DriverDecisionEmailService.class));
    @Test void documentPreviewReturnsStoredPdfBytes() throws Exception {
        byte[] pdf = "%PDF-test".getBytes();
        var driver = new Driver(); driver.setUserId(7L);
        var user = new User();
        user.setApplicationDocuments(new ObjectMapper().writeValueAsString(Map.of("licence", Map.of("contentType", "application/pdf", "data", Base64.getEncoder().encodeToString(pdf)))));
        when(drivers.findById(42L)).thenReturn(Optional.of(driver));
        when(users.findById(7L)).thenReturn(Optional.of(user));
        var response = controller.getApplicationDocument(42L, "licence");
        assertEquals(200, response.getStatusCode().value());
        assertArrayEquals(pdf, (byte[])response.getBody());
        assertEquals("no-store", response.getHeaders().getFirst("Cache-Control"));
    }
    @Test void unknownDocumentKindDoesNotFetchPrivateAccount() throws Exception {
        assertEquals(404, controller.getApplicationDocument(42L, "../selfie").getStatusCode().value());
        verifyNoInteractions(users, drivers);
    }
    @Test void documentMetadataCannotBeSubmittedThroughPublicJsonRegistration() throws Exception {
        var request = new ObjectMapper().readValue("{\"applicationDocuments\":\"spoofed\"}", com.campusconnect.dto.RegisterRequest.class);
        assertNull(request.getApplicationDocuments());
    }
}
