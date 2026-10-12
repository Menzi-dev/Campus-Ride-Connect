package com.campusconnect.service;
import com.campusconnect.entity.Driver;
import com.campusconnect.entity.DriverDecisionEmail;
import com.campusconnect.entity.User;
import com.campusconnect.repository.DriverDecisionEmailRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
@Service
public class DriverDecisionEmailService {
    private final DriverDecisionEmailRepository queue;
    private final EmailService email;
    @Value("${app.public-url}") private String publicUrl;
    public DriverDecisionEmailService(DriverDecisionEmailRepository queue, EmailService email) {
        this.queue = queue; this.email = email;
    }
    @Transactional
    public void enqueue(User user, Driver.ApprovalStatus decision) {
        var item = new DriverDecisionEmail();
        item.setRecipient(user.getEmail()); item.setFullName(user.getFullName());
        item.setDecision(decision.name()); item.setNextAttemptAt(Instant.now());
        queue.save(item);
    }
    @Scheduled(fixedDelay = 15000, initialDelay = 15000)
    @Transactional
    public void deliverPending() {
        if (!email.configured()) return;
        for (var item : queue.findTop10BySentAtIsNullAndNextAttemptAtLessThanEqualOrderByIdAsc(Instant.now())) {
            boolean approved = "APPROVED".equals(item.getDecision());
            String subject = "CampusConnect — driver application " + (approved ? "approved" : "rejected");
            String detail = approved
                ? "Your driver application has been approved. Open CampusConnect and log in to start using your driver account."
                : "Your driver application has been rejected. Your account cannot accept rides. Please contact your university administrator if you need clarification or believe this is a mistake.";
            String text = "Hello " + item.getFullName() + ",\n\n" + detail + "\n\nOpen CampusConnect: " + publicUrl;
            String html = EmailService.page(approved ? "Your application is approved" : "Driver application update",
                "<p>Hello " + EmailService.escape(item.getFullName()) + ",</p><p>" + EmailService.escape(detail)
                + "</p><p><a href=\"" + EmailService.escape(publicUrl) + "\">Open CampusConnect</a></p>");
            if (email.send(item.getRecipient(), subject, text, html)) item.setSentAt(Instant.now());
            else {
                item.setAttempts(item.getAttempts() + 1);
                item.setNextAttemptAt(Instant.now().plusSeconds(Math.min(3600, 30L << Math.min(item.getAttempts(), 6))));
            }
            queue.save(item);
        }
    }
}
