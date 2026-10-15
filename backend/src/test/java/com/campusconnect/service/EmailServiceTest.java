// Test feature: check email service behaviour using the cases below. Use the fixtures and any
// mocked dependencies defined here to exercise success and failure cases.
// Where: EmailServiceTest in this file, including configure() and
// missingConfigurationCanFailFastWithoutExposingSecrets().
// How: JUnit executes the test methods. Fixtures and any Mockito mocks in this class provide
// controlled inputs; assertions check the returned values, errors or saved interactions.
package com.campusconnect.service;
import org.junit.jupiter.api.Test;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.Session;
import java.util.Properties;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class EmailServiceTest {
    private final JavaMailSender sender = mock(JavaMailSender.class);
    private final EmailService email = new EmailService(sender);
    private void configure() {
        ReflectionTestUtils.setField(email, "username", "sender@example.com");
        ReflectionTestUtils.setField(email, "password", "test-placeholder");
        ReflectionTestUtils.setField(email, "host", "smtp.gmail.com");
    }
    @Test void missingConfigurationCanFailFastWithoutExposingSecrets() {
        ReflectionTestUtils.setField(email, "required", true);
        assertThrows(IllegalStateException.class, email::diagnoseConfiguration);
        assertFalse(email.send("test@example.com", "test", "body", "<p>body</p>")); verifyNoInteractions(sender);
    }
    @Test void sendsMultipartHtmlAndPlainTextFromConfiguredSender() throws Exception {
        configure(); var message = new MimeMessage(Session.getInstance(new Properties()));
        when(sender.createMimeMessage()).thenReturn(message);
        assertTrue(email.send("test@example.com", "test", "plain", "<p>html</p>"));
        verify(sender).send(message); assertTrue(message.getFrom()[0].toString().contains("sender@example.com"));
        message.saveChanges(); assertTrue(message.isMimeType("multipart/*"));
    }
    @Test void authenticationFailureIsHandled() {
        configure(); when(sender.createMimeMessage()).thenThrow(new MailAuthenticationException("do-not-log-secret"));
        assertFalse(email.send("test@example.com", "test", "plain", "html"));
    }
}
