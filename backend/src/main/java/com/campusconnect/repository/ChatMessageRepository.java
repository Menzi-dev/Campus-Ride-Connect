// Database access: provide saved ChatMessage lookups and updates for the services/controllers.
// Spring implements the named query methods; any written query defines a specific lookup.
// Where: ChatMessageRepository in this file; queries operate on the ChatMessage entity in
// ../entity/ChatMessage.java.
// How: JpaRepository supplies save/find/delete operations. Spring builds queries from names such as
// findByRideIdOrderBySentAtAsc(); @Query adds explicit queries where present.
package com.campusconnect.repository;

import com.campusconnect.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/** Provides Spring Data persistence queries for ride messages. */
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findByRideIdOrderBySentAtAsc(Long rideId);
}