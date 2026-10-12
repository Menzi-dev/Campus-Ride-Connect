package com.campusconnect.service;

import com.campusconnect.dto.RideRequest;
import com.campusconnect.entity.Ride;
import com.campusconnect.repository.RideRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.Instant;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RideRequestGateTest {
    private final RideRepository repository = mock(RideRepository.class);
    private final RideFaceVerificationService face = mock(RideFaceVerificationService.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final RideService service = new RideService();
    private RideRequest request() {
        ReflectionTestUtils.setField(service, "rideRepository", repository);
        ReflectionTestUtils.setField(service, "faceVerification", face);
        ReflectionTestUtils.setField(service, "jdbcTemplate", jdbc);
        var request = new RideRequest(); request.setPaymentMethod("CASH");
        request.setPickupLat(1.0); request.setPickupLng(2.0); request.setDestLat(3.0); request.setDestLng(4.0);
        return request;
    }
    @Test void failedFaceCheckNeverCreatesRideOrPayment() {
        var request = request();
        when(face.consume(1L, request)).thenThrow(new IllegalArgumentException("Face match required"));
        assertThrows(IllegalArgumentException.class, () -> service.requestRide(1L, request));
        verifyNoInteractions(repository, jdbc);
    }
    @Test void successfulMatchCreatesMarkedRideAndPayment() {
        var request = request(); request.setFaceVerificationToken("proof");
        when(repository.findByFaceVerificationKey("proof")).thenReturn(Optional.empty());
        when(face.consume(1L, request)).thenReturn(new RideFaceVerificationService.Receipt(1L, "draft", Instant.now().plusSeconds(60), Instant.now(), .9));
        when(repository.saveAndFlush(any())).thenAnswer(invocation -> { Ride ride = invocation.getArgument(0); ride.setId(42L); return ride; });
        var ride = service.requestRide(1L, request);
        assertEquals(Ride.RideStatus.PENDING, ride.getStatus()); assertNotNull(ride.getFaceMatchedAt());
        var order = inOrder(face, repository, jdbc);
        order.verify(face).consume(1L, request); order.verify(repository).saveAndFlush(any());
        verify(jdbc).update(anyString(), eq(42L), eq(1L), isNull(), eq("CASH"), isNull());
    }
    @Test void retryReturnsExistingRideWithoutSecondPayment() {
        var request = request(); request.setFaceVerificationToken("proof");
        var ride = new Ride(); ride.setRiderId(1L); ride.setFaceRequestFingerprint("same");
        when(repository.findByFaceVerificationKey("proof")).thenReturn(Optional.of(ride));
        when(face.fingerprint(request)).thenReturn("same");
        assertSame(ride, service.requestRide(1L, request));
        verify(face, never()).consume(anyLong(), any()); verifyNoInteractions(jdbc);
    }
}
