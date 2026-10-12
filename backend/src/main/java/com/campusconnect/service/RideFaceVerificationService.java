package com.campusconnect.service;

import com.campusconnect.dto.RideRequest;
import com.campusconnect.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RideFaceVerificationService {
    private final UserRepository users;
    private final ObjectMapper json;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    private final Map<String, Receipt> receipts = new ConcurrentHashMap<>();
    private final Map<Long, Instant> lastAttempts = new ConcurrentHashMap<>();
    public record Receipt(Long userId, String draft, Instant expiresAt, Instant matchedAt, double similarity) {}

    public RideFaceVerificationService(UserRepository users, ObjectMapper json) {
        this.users = users; this.json = json;
    }

    public String verify(Long userId, String image, RideRequest draft) throws Exception {
        Instant now = Instant.now();
        synchronized (lastAttempts) {
            Instant previous = lastAttempts.get(userId);
            if (previous != null && now.isBefore(previous.plusSeconds(3)))
                throw new IllegalArgumentException("Please wait a moment before retrying the face scan.");
            lastAttempts.put(userId, now);
            lastAttempts.entrySet().removeIf(entry -> entry.getValue().isBefore(now.minusSeconds(600)));
        }
        var account = users.findById(userId).orElseThrow(() -> new IllegalArgumentException("Account not found"));
        String reference = account.getFaceEnrollmentPhoto();
        // Older registrations saved a JPEG in the misleadingly named embedding column.
        if ((reference == null || reference.isBlank()) && account.getFaceEmbedding() != null
                && account.getFaceEmbedding().startsWith("data:image/jpeg;base64,"))
            reference = account.getFaceEmbedding();
        if (reference == null || reference.isBlank())
            throw new IllegalArgumentException("This account has no guided face enrollment. Contact support before requesting a ride.");
        if (image == null || image.length() > 2800000 || draft == null)
            throw new IllegalArgumentException("A fresh face scan and ride details are required.");
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:8090/compare"))
            .timeout(Duration.ofSeconds(25)).header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(Map.of("reference", reference, "probe", image)))).build();
        HttpResponse<String> response;
        try { response = client.send(request, HttpResponse.BodyHandlers.ofString()); }
        catch (Exception error) { throw new IllegalStateException("Face matching is unavailable. Please try again shortly."); }
        JsonNode result = json.readTree(response.body());
        if (response.statusCode() != 200)
            throw new IllegalArgumentException(result.path("error").asText("Could not compare your face. Please try again."));
        if (!result.path("matched").asBoolean(false))
            throw new IllegalArgumentException("Your face did not match this account's enrollment. Please try again in good lighting.");
        String token = UUID.randomUUID().toString();
        receipts.entrySet().removeIf(entry -> !entry.getValue().expiresAt().isAfter(now));
        receipts.put(token, new Receipt(userId, fingerprint(draft), now.plusSeconds(120), now,
            result.path("similarity").asDouble()));
        return token;
    }

    public String fingerprint(RideRequest draft) {
        var tree = json.valueToTree(draft);
        ((com.fasterxml.jackson.databind.node.ObjectNode) tree).remove("faceVerificationToken");
        return tree.toString();
    }

    public RideRequest driverAcceptanceDraft(Long rideId, String token) {
        var draft = new RideRequest();
        draft.setClientRequestId("driver-accept:" + rideId);
        draft.setFaceVerificationToken(token);
        return draft;
    }

    public synchronized Receipt consume(Long userId, RideRequest draft) {
        String token = draft.getFaceVerificationToken();
        Receipt receipt = token == null ? null : receipts.get(token);
        if (receipt == null || !receipt.userId().equals(userId) || !receipt.expiresAt().isAfter(Instant.now())
                || !receipt.draft().equals(fingerprint(draft)))
            throw new IllegalArgumentException("Complete a fresh face match for these ride details before requesting a ride.");
        receipts.remove(token);
        return receipt;
    }
}
