package com.campusconnect.service;

import com.campusconnect.entity.PasswordResetCode;
import com.campusconnect.entity.User;
import com.campusconnect.repository.PasswordResetCodeRepository;
import com.campusconnect.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.logging.Level;
import java.util.logging.Logger;

@Service
public class PasswordResetService {

    private static final Logger logger = Logger.getLogger(PasswordResetService.class.getName());
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int MAX_ATTEMPTS = 5;

    private final PasswordResetCodeRepository resetCodeRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JavaMailSender mailSender;

    @Value("${app.password-reset.from}")
    private String fromAddress;

    public PasswordResetService(
            PasswordResetCodeRepository resetCodeRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JavaMailSender mailSender) {
        this.resetCodeRepository = resetCodeRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailSender = mailSender;
    }

    public void requestCode(String rawEmail) {
        String email = normalizeEmail(rawEmail);
        if (userRepository.findByEmail(email).isEmpty()) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        if (resetCodeRepository.findByEmail(email)
                .filter(existing -> existing.getCreatedAt().isAfter(now.minusSeconds(60)))
                .isPresent()) {
            return;
        }

        String code = String.format(Locale.ROOT, "%06d", SECURE_RANDOM.nextInt(1_000_000));
        PasswordResetCode resetCode = resetCodeRepository.findByEmail(email).orElseGet(PasswordResetCode::new);
        resetCode.setEmail(email);
        resetCode.setCodeHash(passwordEncoder.encode(code));
        resetCode.setCreatedAt(now);
        resetCode.setExpiresAt(now.plusMinutes(10));
        resetCode.setAttempts(0);
        resetCodeRepository.save(resetCode);

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(email);
            message.setSubject("CampusConnect password reset code");
            message.setText("Your CampusConnect password reset code is " + code
                    + ". It expires in 10 minutes and can only be used once."
                    + " Never share this code with anyone."
                    + " If you did not request this, you can ignore this email.");
            mailSender.send(message);
        } catch (Exception e) {
            resetCodeRepository.delete(resetCode);
            logger.log(Level.WARNING, "Could not send a password reset email", e);
        }
    }

    @Transactional(noRollbackFor = IllegalArgumentException.class)
    public void verifyCode(String rawEmail, String code) {
        findAndVerifyCode(normalizeEmail(rawEmail), code);
    }

    @Transactional(noRollbackFor = IllegalArgumentException.class)
    public void resetPassword(String rawEmail, String code, String newPassword) {
        String email = normalizeEmail(rawEmail);
        PasswordResetCode resetCode = findAndVerifyCode(email, code);

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("That code is invalid or expired"));
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        resetCodeRepository.delete(resetCode);
    }

    private PasswordResetCode findAndVerifyCode(String email, String code) {
        PasswordResetCode resetCode = resetCodeRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("That code is invalid or expired"));

        if (resetCode.getExpiresAt().isBefore(LocalDateTime.now())) {
            resetCodeRepository.delete(resetCode);
            throw new IllegalArgumentException("That code is invalid or expired");
        }

        if (resetCode.getAttempts() >= MAX_ATTEMPTS) {
            resetCodeRepository.delete(resetCode);
            throw new IllegalArgumentException("Too many attempts. Request a new code.");
        }

        if (!passwordEncoder.matches(code, resetCode.getCodeHash())) {
            resetCode.setAttempts(resetCode.getAttempts() + 1);
            if (resetCode.getAttempts() >= MAX_ATTEMPTS) {
                resetCodeRepository.delete(resetCode);
                throw new IllegalArgumentException("Too many attempts. Request a new code.");
            }
            resetCodeRepository.save(resetCode);
            throw new IllegalArgumentException("That code is invalid or expired");
        }

        return resetCode;
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}