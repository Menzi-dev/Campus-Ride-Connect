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
import java.util.List;
import java.util.Map;

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

    @GetMapping
    public ResponseEntity<?> getMessages(@PathVariable Long rideId) {
        Long userId = currentUserId();
        Ride ride = authorizedRide(rideId, userId);
        if (ride == null) return ResponseEntity.status(403).body(Map.of("error", "You are not a participant in this ride"));
        return ResponseEntity.ok(messageRepository.findByRideIdOrderBySentAtAsc(rideId).stream().map(this::messageResponse).toList());
    }

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

    private Ride authorizedRide(Long rideId, Long userId) {
        return rideRepository.findById(rideId)
                .filter(ride -> userId.equals(ride.getRiderId()) || userId.equals(ride.getDriverId()))
                .orElse(null);
    }

    private Map<String, Object> messageResponse(ChatMessage message) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", message.getId());
        response.put("senderId", message.getSenderId());
        response.put("message", message.getMessageText());
        response.put("sentAt", message.getSentAt());
        userRepository.findById(message.getSenderId()).ifPresent(sender -> response.put("senderName", sender.getFullName()));
        return response;
    }

    private Long currentUserId() {
        return Long.valueOf((String) SecurityContextHolder.getContext().getAuthentication().getPrincipal());
    }
}