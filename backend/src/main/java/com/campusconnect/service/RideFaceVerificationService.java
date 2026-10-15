// Face comparison rules: call the local Python matcher and issue a short-lived confirmation tied to
// an account and exact ride details. Check and remove a confirmation when it is used.
// Where: RideFaceVerificationService, starting with verify(), fingerprint() and consume() in this
// file.
// How: verify() loads User enrollment via users.findById(), posts reference/probe JSON to Python at
// 127.0.0.1:8090/compare and checks matched. receipts stores a UUID with userId, fingerprint(draft)
// and a 120-second expiry.
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

/** Calls the local face matcher and issues short-lived, single-use confirmations bound to account and ride details. */
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

    // Feature: Rate-limit repeated scans, compare the fresh image with enrollment through Python
    // and issue a 120-second confirmation for the exact ride details.
    // Where: RideFaceVerificationService.verify() below.
    // How: verify() loads User enrollment via users.findById(), posts reference/probe JSON to
    // Python at 127.0.0.1:8090/compare and checks matched. receipts stores a UUID with userId,
    // fingerprint(draft) and a 120-second expiry.
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

    // Feature: Turn the ride details into a comparable value, excluding the confirmation token
    // itself.
    // Where: RideFaceVerificationService.fingerprint() below.
    // How: fingerprint() uses ObjectMapper.valueToTree() and removes faceVerificationToken. The
    // resulting JSON is compared when consume() checks that booking details have not changed.
    public String fingerprint(RideRequest draft) {
        // Exclude the receipt token so verification and submission compare the same journey fields.
        var tree = json.valueToTree(draft);
        ((com.fasterxml.jackson.databind.node.ObjectNode) tree).remove("faceVerificationToken");
        return tree.toString();
    }

    // Feature: Build ride-specific details so a driver confirmation cannot be used for a different
    // request.
    // Where: RideFaceVerificationService.driverAcceptanceDraft() below.
    // How: driverAcceptanceDraft() sets clientRequestId to driver-accept plus the ride ID. verify()
    // and consume() use this same draft to bind a driver confirmation to one request.
    public RideRequest driverAcceptanceDraft(Long rideId, String token) {
        var draft = new RideRequest();
        draft.setClientRequestId("driver-accept:" + rideId);
        draft.setFaceVerificationToken(token);
        return draft;
    }

    // Feature: Check the confirmation owner, expiry and exact details, then remove it so it cannot
    // authorise another new action.
    // Where: RideFaceVerificationService.consume() below.
    // How: consume() looks up receipts with draft.getFaceVerificationToken(), checks userId,
    // expiresAt and fingerprint(), then removes the receipt. synchronized prevents two requests
    // consuming it together.
    public synchronized Receipt consume(Long userId, RideRequest draft) {
        // Synchronize validation and removal so simultaneous requests cannot reuse one receipt.
        String token = draft.getFaceVerificationToken();
        Receipt receipt = token == null ? null : receipts.get(token);
        if (receipt == null || !receipt.userId().equals(userId) || !receipt.expiresAt().isAfter(Instant.now())
                || !receipt.draft().equals(fingerprint(draft)))
            throw new IllegalArgumentException("Complete a fresh face match for these ride details before requesting a ride.");
        receipts.remove(token);
        return receipt;
    }
}
