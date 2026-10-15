// Email ownership checks: issue a verification link/code, store its hash and enforce expiry, use
// and retry rules before marking the account verified.
// Where: EmailVerificationService, starting with issue(), verify() and verifyCode() in this file.
// How: issue() generates a link/code and stores a token hash through tokens. It checks the previous
// issue time before sending VerificationMail through the configured mail flow.
package com.campusconnect.service;

import com.campusconnect.entity.EmailVerificationToken;
import com.campusconnect.entity.User;
import com.campusconnect.repository.EmailVerificationTokenRepository;
import com.campusconnect.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionalEventListener;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;

/** Issues hashed verification links and codes, enforces expiry and retry limits, and marks accounts verified. */
@Service
public class EmailVerificationService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private final EmailVerificationTokenRepository tokens;
    private final UserRepository users;
    private final ApplicationEventPublisher events;
    private final EmailService email;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    @Value("${app.public-url}") private String publicUrl;
    @Value("${app.email-verification.expiry-minutes:60}") private long expiryMinutes;
    @Value("${app.email-verification.cooldown-seconds:60}") private long cooldownSeconds;
    @Value("${app.email-verification.delivery-mode:code}") private String deliveryMode = "code";
    // Tokens exist only in memory until mailed. They are never returned to clients or stored as plaintext.
    public static final class VerificationMail {
        private final String recipient, token, code;
        public VerificationMail(String recipient, String token, String code) { this.recipient = recipient; this.token = token; this.code = code; }
        public String recipient() { return recipient; }
        public String token() { return token; }
        public String code() { return code; }
    }
    public EmailVerificationService(EmailVerificationTokenRepository tokens, UserRepository users,
                                    ApplicationEventPublisher events, EmailService email,
                                    org.springframework.security.crypto.password.PasswordEncoder passwordEncoder) {
        this.tokens = tokens; this.users = users; this.events = events; this.email = email;
        this.passwordEncoder = passwordEncoder;
    }

    // Feature: Create a temporary email confirmation and schedule its delivery while enforcing the
    // resend wait.
    // Where: EmailVerificationService.issue() below.
    // How: issue() generates a link/code and stores a token hash through tokens. It checks the
    // previous issue time before sending VerificationMail through the configured mail flow.
    @Transactional
    public void issue(User user) {
        if (!user.requiresEmailVerification()) return;
        var existing = tokens.findByUserId(user.getId());
        Instant now = Instant.now();
        if (existing.isPresent() && existing.get().getCreatedAt().plusSeconds(Math.max(60, cooldownSeconds)).isAfter(now)) return;
        // Validate URL before storing anything. Never derive links from an untrusted Host header.
        verificationUrl("validation");
        byte[] bytes = new byte[32]; RANDOM.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        String code = String.format(Locale.ROOT, "%06d", RANDOM.nextInt(1_000_000));
        var token = existing.orElseGet(EmailVerificationToken::new);
        token.setUserId(user.getId()); token.setEmail(user.getEmail()); token.setTokenHash(hash(raw));
        token.setCreatedAt(now); token.setExpiresAt(now.plusSeconds(Math.max(5, expiryMinutes) * 60)); token.setUsedAt(null);
        token.setCodeHash(passwordEncoder.encode(code));
        token.setCodeExpiresAt(now.plusSeconds(Math.min(10, Math.max(5, expiryMinutes)) * 60));
        token.setCodeAttempts(0);
        tokens.save(token);
        events.publishEvent(new VerificationMail(user.getEmail(), raw, code));
    }

    // Feature: Look up the account email and request another confirmation through the shared issue
    // flow.
    // Where: EmailVerificationService.resend() below.
    // How: resend() uses users.findByEmailForUpdate() to read, validate or save the data for this
    // operation. The return/exception handling below supplies its result to the caller.
    @Transactional
    public void resend(String rawEmail) {
        String address = rawEmail.trim().toLowerCase(Locale.ROOT);
        users.findByEmailForUpdate(address).filter(User::requiresEmailVerification).ifPresent(this::issue);
    }

    // Feature: Find the stored link hash, check validity and mark the linked account email
    // verified.
    // Where: EmailVerificationService.verify() below.
    // How: verify() hashes the received link value, finds its stored token, checks validity and
    // saves the linked account emailVerified flag through users.
    @Transactional
    public void verify(String raw) {
        if (raw == null || !raw.matches("[A-Za-z0-9_-]{43}")) throw invalid();
        String digest = hash(raw);
        var address = tokens.findEmailByTokenHash(digest).orElseThrow(EmailVerificationService::invalid);
        var user = users.findByEmailForUpdate(address).orElseThrow(EmailVerificationService::invalid);
        var token = tokens.findByUserIdForUpdate(user.getId()).orElseThrow(EmailVerificationService::invalid);
        if (!token.getTokenHash().equals(digest) || !token.getUserId().equals(user.getId())
            || token.getUsedAt() != null || !token.getExpiresAt().isAfter(Instant.now())
            || !token.getEmail().equals(user.getEmail())) throw invalid();
        user.setEmailVerified(true); token.setUsedAt(Instant.now());
        users.save(user); tokens.save(token);
    }

    // Feature: Check the email code hash, expiry and failed attempts before marking the account
    // verified.
    // Where: EmailVerificationService.verifyCode() below.
    // How: verifyCode() hashes the submitted code, checks the stored email token, expiry and
    // attempts, then saves the account verified state. Failed attempts remain recorded.
    @Transactional(noRollbackFor = IllegalArgumentException.class)
    public void verifyCode(String rawEmail, String code) {
        // Failed checks must commit their attempt count, even though validation throws an error.
        if (rawEmail == null || code == null || !code.matches("\\d{6}")) throw invalidCode();
        var user = users.findByEmailForUpdate(rawEmail.trim().toLowerCase(Locale.ROOT))
            .orElseThrow(EmailVerificationService::invalidCode);
        var token = tokens.findByUserIdForUpdate(user.getId()).orElseThrow(EmailVerificationService::invalidCode);
        if (user.isEmailVerified() || token.getUsedAt() != null || token.getCodeHash() == null
            || token.getCodeExpiresAt() == null || !token.getCodeExpiresAt().isAfter(Instant.now())
            || !token.getEmail().equals(user.getEmail()) || token.getCodeAttempts() >= 5) throw invalidCode();
        if (!passwordEncoder.matches(code, token.getCodeHash())) {
            token.setCodeAttempts(token.getCodeAttempts() + 1); tokens.save(token);
            throw invalidCode();
        }
        user.setEmailVerified(true); token.setUsedAt(Instant.now());
        users.save(user); tokens.save(token);
    }

    // Feature: Build and send the configured code or link email without storing the raw secret in
    // the database.
    // Where: EmailVerificationService.sendVerificationMail() below.
    // How: sendVerificationMail() uses email.send(), EmailService.page() and EmailService.escape()
    // to read, validate or save the data for this operation. The return/exception handling below
    // supplies its result to the caller.
    @TransactionalEventListener
    public void sendVerificationMail(VerificationMail request) {
        // Send after the registration transaction commits so a rolled-back account gets no email.
        if (!"link".equalsIgnoreCase(deliveryMode)) {
            long minutes = Math.min(10, Math.max(5, expiryMinutes));
            String text = "Welcome to CampusConnect.\n\nYour email verification code is " + request.code()
                + ".\nReturn to the app, enter this code on the Verify your email screen, and select Verify email."
                + "\nThis code expires in " + minutes + " minutes and can only be used once."
                + "\nNever share this code. If it expires, select Resend verification email in the app."
                + "\nIf you did not create this account, ignore this email.";
            email.send(request.recipient(), "CampusConnect email verification code", text,
                EmailService.page("Verify your email", "<p>Welcome! Use this code to confirm your CampusConnect email address:</p>"
                    + "<p style=\"font-size:28px;font-weight:bold;letter-spacing:6px\">" + request.code()
                    + "</p><p>Return to the app, enter the code and select <b>Verify email</b>.</p><p>Expires in " + minutes
                    + " minutes and works once. Never share this code.</p><p>If it expires, select <b>Resend verification email</b> in the app.</p>"
                    + "<p>If you did not create this account, ignore this email.</p>"));
            return;
        }
        String link = verificationUrl(request.token());
        long minutes = Math.max(5, expiryMinutes);
        String text = "Welcome to CampusConnect. Verify your email address to complete registration: " + link
            + "\nThis link expires in " + minutes + " minutes and can be used once. If it expires, choose Resend verification email in the app."
            + "\nIf you did not create this account, ignore this email.";
        email.send(request.recipient(), "CampusConnect — verify your email", text, EmailService.page("Verify your email address",
            "<p>Welcome! Confirm your email to complete your CampusConnect registration.</p><p><a style=\"background:#16a34a;color:white;padding:12px 18px;border-radius:8px;display:inline-block\" href=\""
            + EmailService.escape(link) + "\">Verify email</a></p><p>Link expires in " + minutes
            + " minutes and works once. If it expires, choose <b>Resend verification email</b> in the app.</p>"
            + "<p>If the button does not work, copy this link:</p><p>" + EmailService.escape(link)
            + "</p><p>If you did not create an account, ignore this email.</p>"));
    }

    private String verificationUrl(String token) {
        URI url = URI.create(publicUrl);
        if (!java.util.Set.of("http", "https").contains(url.getScheme()) || url.getHost() == null
            || url.getRawQuery() != null || url.getRawFragment() != null || url.getUserInfo() != null)
            throw new IllegalStateException("APP_PUBLIC_URL must be the browser app's HTTP(S) base URL, without query or fragment.");
        return publicUrl.replaceAll("/+$", "") + "/#verify-email=" + token;
    }
    static String hash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException error) { throw new IllegalStateException("SHA-256 unavailable"); }
    }
    private static IllegalArgumentException invalid() { return new IllegalArgumentException("This verification link is invalid, expired or already used. Request a new link."); }
    private static IllegalArgumentException invalidCode() { return new IllegalArgumentException("That verification code is invalid, expired or already used. Request a new code if needed."); }
}
