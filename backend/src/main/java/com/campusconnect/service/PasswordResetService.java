// Password recovery: issue and check a temporary emailed code, then replace the password with a new
// hash after successful validation.
// Where: PasswordResetService, starting with requestCode(), verifyCode() and resetPassword() in
// this file.
// How: requestCode() creates a random temporary code, stores its hash and expiry through the
// reset-code repository and sends instructions using EmailService. The code itself is sent by
// email.
package com.campusconnect.service;

import com.campusconnect.entity.PasswordResetCode;
import com.campusconnect.entity.User;
import com.campusconnect.repository.PasswordResetCodeRepository;
import com.campusconnect.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Locale;

/** Issues expiring hashed reset codes and replaces the password only after a successful code check. */
@Service
public class PasswordResetService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int MAX_ATTEMPTS = 5;

    private final PasswordResetCodeRepository resetCodeRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    public PasswordResetService(
            PasswordResetCodeRepository resetCodeRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            EmailService emailService) {
        this.resetCodeRepository = resetCodeRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
    }

    // Feature: Create a temporary recovery code, store its hash and expiry, and send recovery
    // instructions by email.
    // Where: PasswordResetService.requestCode() below.
    // How: requestCode() creates a random temporary code, stores its hash and expiry through the
    // reset-code repository and sends instructions using EmailService. The code itself is sent by
    // email.
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

        String text = "Your CampusConnect password reset code is " + code
                    + ". It expires in 10 minutes and can only be used once."
                    + " Never share this code with anyone."
                    + " If you did not request this, you can ignore this email.";
        if (!emailService.send(email, "CampusConnect password reset code", text,
            EmailService.page("Reset your password", "<p>Your reset code:</p><p style=\"font-size:28px;font-weight:bold;letter-spacing:6px\">"
                + code + "</p><p>Expires in 10 minutes and can be used once. Never share this code.</p>"
                + "<p>If you did not request a reset, ignore this email.</p>"))) {
            resetCodeRepository.delete(resetCode);
        }
    }

    // Feature: Validate the email and recovery code through the shared expiry and attempt checks.
    // Where: PasswordResetService.verifyCode() below.
    // How: verifyCode() calls findAndVerifyCode() and normalizeEmail() in this class to carry out
    // the operation. Any failed checks stop the operation with the exception shown below.
    @Transactional(noRollbackFor = IllegalArgumentException.class)
    public void verifyCode(String rawEmail, String code) {
        // Commit failed-attempt updates and expired-code deletion despite validation errors.
        findAndVerifyCode(normalizeEmail(rawEmail), code);
    }

    // Feature: Check the recovery code and new password, save a new password hash and remove the
    // used code.
    // Where: PasswordResetService.resetPassword() below.
    // How: resetPassword() uses findAndVerifyCode(), hashes the new password with passwordEncoder
    // and saves the User. The used recovery code is removed from the reset repository.
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

    // Feature: Check expiry and failed attempts before accepting the recovery code.
    // Where: PasswordResetService.findAndVerifyCode() below.
    // How: findAndVerifyCode() uses resetCodeRepository.findByEmail(), resetCodeRepository.delete()
    // and passwordEncoder.matches() to read, validate or save the data for this operation. The
    // return/exception handling below supplies its result to the caller.
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
