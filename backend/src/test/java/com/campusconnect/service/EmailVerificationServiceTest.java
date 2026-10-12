package com.campusconnect.service;

import com.campusconnect.entity.*;
import com.campusconnect.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.Instant;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EmailVerificationServiceTest {
    private final EmailVerificationTokenRepository tokens = mock(EmailVerificationTokenRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    private final EmailService email = mock(EmailService.class);
    private final org.springframework.security.crypto.password.PasswordEncoder encoder = mock(org.springframework.security.crypto.password.PasswordEncoder.class);
    private final EmailVerificationService service = new EmailVerificationService(tokens, users, events, email, encoder);
    private User user;
    private final String raw = "A".repeat(43);
    @BeforeEach void setup() {
        ReflectionTestUtils.setField(service, "publicUrl", "https://campus.example");
        ReflectionTestUtils.setField(service, "expiryMinutes", 60L);
        ReflectionTestUtils.setField(service, "cooldownSeconds", 60L);
        user = new User(); user.setId(19L); user.setEmail("test@example.com"); user.setEmailVerified(false);
    }
    @Test void generatesRandomTokenStoresOnlyHashAndPublishesAfterCommitMailEvent() {
        when(encoder.encode(anyString())).thenReturn("bcrypt-code-hash");
        service.issue(user);
        var tokenCaptor = org.mockito.ArgumentCaptor.forClass(EmailVerificationToken.class);
        var eventCaptor = org.mockito.ArgumentCaptor.forClass(Object.class);
        verify(tokens).save(tokenCaptor.capture()); verify(events).publishEvent(eventCaptor.capture());
        var mail = (EmailVerificationService.VerificationMail) eventCaptor.getValue();
        assertTrue(mail.token().matches("[A-Za-z0-9_-]{43}"));
        assertEquals(EmailVerificationService.hash(mail.token()), tokenCaptor.getValue().getTokenHash());
        assertNotEquals(mail.token(), tokenCaptor.getValue().getTokenHash());
        assertTrue(tokenCaptor.getValue().getExpiresAt().isAfter(Instant.now().plusSeconds(3500)));
        assertEquals(user.getEmail(), mail.recipient());
        assertTrue(mail.code().matches("\\d{6}"));
        assertEquals("bcrypt-code-hash", tokenCaptor.getValue().getCodeHash());
        assertNotEquals(mail.code(), tokenCaptor.getValue().getCodeHash());
        verifyNoInteractions(email);
    }
    @Test void defaultEmailContainsCodeAndInstructionsWithoutExternalUrls() {
        service.sendVerificationMail(new EmailVerificationService.VerificationMail(user.getEmail(), raw, "123456"));
        var text = org.mockito.ArgumentCaptor.forClass(String.class);
        var html = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(email).send(eq(user.getEmail()), eq("CampusConnect email verification code"), text.capture(), html.capture());
        assertTrue(text.getValue().contains("123456")); assertTrue(text.getValue().contains("10 minutes"));
        assertTrue(html.getValue().contains("Verify email"));
        assertFalse(text.getValue().contains("http")); assertFalse(html.getValue().contains("href="));
    }
    @Test void validCodeVerifiesAndConsumesBothCodeAndLink() {
        var token = prepareCode(); when(encoder.matches("123456", "bcrypt-code")).thenReturn(true);
        service.verifyCode(user.getEmail(), "123456");
        assertTrue(user.isEmailVerified()); assertNotNull(token.getUsedAt());
        assertThrows(IllegalArgumentException.class, () -> service.verifyCode(user.getEmail(), "123456"));
        assertThrows(IllegalArgumentException.class, () -> service.verify(raw));
    }
    @Test void incorrectCodesAreLimitedToFiveAttempts() {
        var token = prepareCode();
        for (int attempt = 0; attempt < 7; attempt++)
            assertThrows(IllegalArgumentException.class, () -> service.verifyCode(user.getEmail(), "999999"));
        assertEquals(5, token.getCodeAttempts()); verify(encoder, times(5)).matches("999999", "bcrypt-code");
        assertFalse(user.isEmailVerified());
    }
    @Test void expiredOrMissingCodeIsRejected() {
        var token = prepareCode(); token.setCodeExpiresAt(Instant.now().minusSeconds(1));
        assertThrows(IllegalArgumentException.class, () -> service.verifyCode(user.getEmail(), "123456"));
        token.setCodeHash(null);
        assertThrows(IllegalArgumentException.class, () -> service.verifyCode(user.getEmail(), "123456"));
        verifyNoInteractions(encoder);
    }
    @Test void unknownEmailAndMalformedCodeCannotVerify() {
        assertThrows(IllegalArgumentException.class, () -> service.verifyCode("unknown@example.com", "123456"));
        assertThrows(IllegalArgumentException.class, () -> service.verifyCode(user.getEmail(), raw));
        assertThrows(IllegalArgumentException.class, () -> service.verifyCode(user.getEmail(), null));
        verifyNoInteractions(encoder); assertFalse(user.isEmailVerified());
    }
    private EmailVerificationToken prepareCode() {
        var token = prepare(); token.setCodeHash("bcrypt-code"); token.setCodeExpiresAt(Instant.now().plusSeconds(600));
        return token;
    }
    @Test void validTokenVerifiesCorrectAccountAndIsConsumed() {
        var token = prepare();
        service.verify(raw);
        assertTrue(user.isEmailVerified()); assertNotNull(token.getUsedAt());
        verify(users).save(user); verify(tokens).save(token);
        assertThrows(IllegalArgumentException.class, () -> service.verify(raw));
    }
    @Test void rejectsExpiredToken() {
        var token = prepare(); token.setExpiresAt(Instant.now().minusSeconds(1));
        assertThrows(IllegalArgumentException.class, () -> service.verify(raw)); assertFalse(user.isEmailVerified());
    }
    @Test void rejectsMalformedResetCodeAndUnknownToken() {
        assertThrows(IllegalArgumentException.class, () -> service.verify("123456"));
        assertThrows(IllegalArgumentException.class, () -> service.verify(null));
        assertThrows(IllegalArgumentException.class, () -> service.verify(raw)); verifyNoInteractions(users);
    }
    @Test void resendInvalidatesOldLink() {
        var token = prepare(); token.setCreatedAt(Instant.now().minusSeconds(61));
        when(tokens.findByUserId(user.getId())).thenReturn(Optional.of(token));
        service.resend("TEST@example.com");
        assertNotEquals(EmailVerificationService.hash(raw), token.getTokenHash());
        assertThrows(IllegalArgumentException.class, () -> service.verify(raw));
    }
    @Test void resendCooldownAndUnknownEmailDoNotSend() {
        var token = new EmailVerificationToken(); token.setCreatedAt(Instant.now());
        when(users.findByEmailForUpdate(user.getEmail())).thenReturn(Optional.of(user));
        when(tokens.findByUserId(user.getId())).thenReturn(Optional.of(token));
        service.resend(user.getEmail()); service.resend("unknown@example.com");
        verifyNoInteractions(events, email); verify(tokens, never()).save(any());
    }
    @Test void verifiedAccountsDoNotReceiveResend() {
        user.setEmailVerified(true); when(users.findByEmailForUpdate(user.getEmail())).thenReturn(Optional.of(user));
        service.resend(user.getEmail()); verifyNoInteractions(tokens, events, email);
    }
    @Test void emailUsesConfiguredHttpsFragmentLinkAndExpiry() {
        ReflectionTestUtils.setField(service, "deliveryMode", "link");
        service.sendVerificationMail(new EmailVerificationService.VerificationMail(user.getEmail(), raw, "123456"));
        verify(email).send(eq(user.getEmail()), anyString(), contains("https://campus.example/#verify-email="), contains("60 minutes"));
    }
    @Test void rejectsChangedAccountEmail() {
        prepare(); user.setEmail("changed@example.com");
        assertThrows(IllegalArgumentException.class, () -> service.verify(raw)); assertFalse(user.isEmailVerified());
    }
    private EmailVerificationToken prepare() {
        var token = new EmailVerificationToken(); token.setUserId(user.getId()); token.setEmail(user.getEmail());
        token.setTokenHash(EmailVerificationService.hash(raw)); token.setCreatedAt(Instant.now().minusSeconds(120));
        token.setExpiresAt(Instant.now().plusSeconds(3600));
        when(tokens.findEmailByTokenHash(token.getTokenHash())).thenReturn(Optional.of(user.getEmail()));
        when(users.findByEmailForUpdate(user.getEmail())).thenReturn(Optional.of(user));
        when(tokens.findByUserIdForUpdate(user.getId())).thenReturn(Optional.of(token));
        return token;
    }
}
