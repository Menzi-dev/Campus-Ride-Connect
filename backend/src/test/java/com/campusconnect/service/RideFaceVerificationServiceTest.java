package com.campusconnect.service;

import com.campusconnect.dto.RideRequest;
import com.campusconnect.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.Instant;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class RideFaceVerificationServiceTest {
    private final RideFaceVerificationService service = new RideFaceVerificationService(mock(UserRepository.class), new ObjectMapper());
    private RideRequest draft() {
        var draft = new RideRequest(); draft.setPickupLat(-28.74); draft.setDestLat(-28.75);
        draft.setPaymentMethod("CASH"); draft.setFaceVerificationToken("proof"); return draft;
    }
    @SuppressWarnings("unchecked")
    private void grant(Long owner, RideRequest draft, Instant expiry) {
        var receipts = (Map<String, RideFaceVerificationService.Receipt>) ReflectionTestUtils.getField(service, "receipts");
        receipts.put("proof", new RideFaceVerificationService.Receipt(owner, service.fingerprint(draft), expiry, Instant.now(), 0.9));
    }
    @Test void confirmationIsSingleUse() {
        var draft = draft(); grant(1L, draft, Instant.now().plusSeconds(60));
        assertEquals(1L, service.consume(1L, draft).userId());
        assertThrows(IllegalArgumentException.class, () -> service.consume(1L, draft));
    }
    @Test void anotherAccountCannotUseConfirmation() {
        var draft = draft(); grant(1L, draft, Instant.now().plusSeconds(60));
        assertThrows(IllegalArgumentException.class, () -> service.consume(2L, draft));
        assertNotNull(service.consume(1L, draft));
    }
    @Test void changedRideCannotUseConfirmation() {
        var draft = draft(); grant(1L, draft, Instant.now().plusSeconds(60));
        draft.setDestLat(-29.0);
        assertThrows(IllegalArgumentException.class, () -> service.consume(1L, draft));
    }
    @Test void expiredConfirmationIsRejected() {
        var draft = draft(); grant(1L, draft, Instant.now().minusSeconds(1));
        assertThrows(IllegalArgumentException.class, () -> service.consume(1L, draft));
    }
    @Test void missingConfirmationIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.consume(1L, draft()));
    }
    @Test void driverConfirmationCannotAcceptAnotherRideOrCreateRiderBooking() {
        var acceptance = service.driverAcceptanceDraft(42L, "proof");
        grant(7L, acceptance, Instant.now().plusSeconds(60));
        assertThrows(IllegalArgumentException.class, () -> service.consume(7L, service.driverAcceptanceDraft(43L, "proof")));
        assertThrows(IllegalArgumentException.class, () -> service.consume(7L, draft()));
        assertNotNull(service.consume(7L, acceptance));
    }
}
