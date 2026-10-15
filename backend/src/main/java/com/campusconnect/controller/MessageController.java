// Ride message API: check access to the ride conversation, retrieve messages and save new messages
// with the signed-in sender.
// Where: MessageController handles /api/rides/{rideId}/messages;
// @GetMapping/@PostMapping/@PutMapping identify the actions below.
// How: Spring reads request fields/path IDs, invokes these controller methods and returns their
// ResponseEntity. Service/repository/JDBC calls inside the methods perform the actual work.
package com.campusconnect.controller;

import com.campusconnect.entity.ChatMessage;
import com.campusconnect.entity.Ride;
import com.campusconnect.repository.ChatMessageRepository;
import com.campusconnect.repository.RideRepository;
import com.campusconnect.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/** Loads and creates ride messages after checking that the current user may access the conversation. */
@RestController
@RequestMapping("/api/rides/{rideId}/messages")
@CrossOrigin(origins = "*")
public class MessageController {

    private final ChatMessageRepository messageRepository;
    private final RideRepository rideRepository;
    private final UserRepository userRepository;

    public MessageController(ChatMessageRepository messageRepository, RideRepository rideRepository,
                             UserRepository userRepository) {
        this.messageRepository = messageRepository;
        this.rideRepository = rideRepository;
        this.userRepository = userRepository;
    }

    // Feature: Check conversation access and return saved messages in send-time order.
    // Where: MessageController.getMessages() below.
    // How: getMessages() uses currentUserId() and authorizedRide(), then
    // messageRepository.findByRideIdOrderBySentAtAsc(). messageResponse() adds display data for the
    // client.
    @GetMapping
    public ResponseEntity<?> getMessages(@PathVariable Long rideId) {
        Long userId = currentUserId();
        Ride ride = authorizedRide(rideId, userId);
        if (ride == null) return ResponseEntity.status(403).body(Map.of("error", "You are not a participant in this ride"));
        return ResponseEntity.ok(messageRepository.findByRideIdOrderBySentAtAsc(rideId).stream().map(this::messageResponse).toList());
    }

    // Feature: Check the ride participant and text, then save a message using the signed-in sender.
    // Where: MessageController.sendMessage() below.
    // How: sendMessage() validates ride participation and text, sets the signed-in sender and
    // timestamp on ChatMessage and saves it with messageRepository.
    @PostMapping
    public ResponseEntity<?> sendMessage(@PathVariable Long rideId, @RequestBody Map<String, String> request) {
        Long userId = currentUserId();
        Ride ride = authorizedRide(rideId, userId);
        if (ride == null) return ResponseEntity.status(403).body(Map.of("error", "You are not a participant in this ride"));

        String text = request.getOrDefault("message", "").trim();
        if (text.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "Message cannot be empty"));
        if (text.length() > 1000) return ResponseEntity.badRequest().body(Map.of("error", "Message is too long"));

        ChatMessage message = new ChatMessage();
        message.setRideId(rideId);
        message.setSenderId(userId);
        message.setMessageText(text);
        message.setSentAt(LocalDateTime.now());
        return ResponseEntity.ok(messageResponse(messageRepository.save(message)));
    }

    // Feature: Find the ride and check whether this user may access its conversation.
    // Where: MessageController.authorizedRide() below.
    // How: authorizedRide() uses rideRepository.findById() to read, validate or save the data for
    // this operation. The return/exception handling below supplies its result to the caller.
    private Ride authorizedRide(Long rideId, Long userId) {
        return rideRepository.findById(rideId)
                .filter(ride -> userId.equals(ride.getRiderId()) || userId.equals(ride.getDriverId()))
                .orElse(null);
    }

    // Feature: Build message display data and add the sender name when the account is available.
    // Where: MessageController.messageResponse() below.
    // How: messageResponse() uses userRepository.findById() to read, validate or save the data for
    // this operation. The return/exception handling below supplies its result to the caller.
    private Map<String, Object> messageResponse(ChatMessage message) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", message.getId());
        response.put("senderId", message.getSenderId());
        response.put("message", message.getMessageText());
        response.put("sentAt", message.getSentAt());
        userRepository.findById(message.getSenderId()).ifPresent(sender -> response.put("senderName", sender.getFullName()));
        return response;
    }

    // Feature: Read the signed-in account identifier from Spring Security instead of trusting a
    // client-supplied identity.
    // Where: MessageController.currentUserId() below.
    // How: currentUserId() uses Long.valueOf() and SecurityContextHolder.getContext() to
    // build/check the result returned by the code below.
    private Long currentUserId() {
        return Long.valueOf((String) SecurityContextHolder.getContext().getAuthentication().getPrincipal());
    }
}
