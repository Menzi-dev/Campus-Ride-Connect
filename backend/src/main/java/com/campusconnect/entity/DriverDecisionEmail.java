package com.campusconnect.entity;
import jakarta.persistence.*;
import java.time.Instant;
@Entity
@Table(name = "driver_decision_emails", indexes = @Index(name = "pending_delivery", columnList = "sent_at,next_attempt_at"))
public class DriverDecisionEmail {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false) private String recipient;
    @Column(name = "full_name", nullable = false) private String fullName;
    @Column(nullable = false) private String decision;
    @Column(nullable = false) private int attempts;
    @Column(name = "next_attempt_at", nullable = false) private Instant nextAttemptAt;
    @Column(name = "sent_at") private Instant sentAt;
    public Long getId() { return id; }
    public String getRecipient() { return recipient; }
    public void setRecipient(String value) { recipient = value; }
    public String getFullName() { return fullName; }
    public void setFullName(String value) { fullName = value; }
    public String getDecision() { return decision; }
    public void setDecision(String value) { decision = value; }
    public int getAttempts() { return attempts; }
    public void setAttempts(int value) { attempts = value; }
    public Instant getNextAttemptAt() { return nextAttemptAt; }
    public void setNextAttemptAt(Instant value) { nextAttemptAt = value; }
    public Instant getSentAt() { return sentAt; }
    public void setSentAt(Instant value) { sentAt = value; }
}
