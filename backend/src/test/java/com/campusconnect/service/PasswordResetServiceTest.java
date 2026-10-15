// Test feature: check password reset service behaviour using the cases below. Use the fixtures and
// any mocked dependencies defined here to exercise success and failure cases.
// Where: PasswordResetServiceTest in this file, including
// requestCodeDoesNotDiscloseUnknownAccounts() and requestCodeEmailsCodeAndStoresOnlyItsHash().
// How: JUnit executes the test methods. Fixtures and any Mockito mocks in this class provide
// controlled inputs; assertions check the returned values, errors or saved interactions.
package com.campusconnect.service;

import com.campusconnect.entity.PasswordResetCode;
import com.campusconnect.entity.User;
import com.campusconnect.repository.PasswordResetCodeRepository;
import com.campusconnect.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceTest {

    private static final String EMAIL = "rider@spu.ac.za";

    @Mock
    private PasswordResetCodeRepository resetCodeRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private EmailService emailService;

    @InjectMocks
    private PasswordResetService passwordResetService;

    @Test
    void requestCodeDoesNotDiscloseUnknownAccounts() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());

        passwordResetService.requestCode(EMAIL);

        verifyNoInteractions(resetCodeRepository, passwordEncoder, emailService);
    }

    @Test
    void requestCodeEmailsCodeAndStoresOnlyItsHash() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(new User()));
        when(resetCodeRepository.findByEmail(EMAIL)).thenReturn(Optional.empty(), Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("bcrypt-hash");
        when(emailService.send(anyString(), anyString(), anyString(), anyString())).thenReturn(true);
        ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<PasswordResetCode> codeCaptor = ArgumentCaptor.forClass(PasswordResetCode.class);

        passwordResetService.requestCode(EMAIL);

        verify(emailService).send(org.mockito.ArgumentMatchers.eq(EMAIL), anyString(), messageCaptor.capture(), anyString());
        verify(resetCodeRepository).save(codeCaptor.capture());

        assertTrue(messageCaptor.getValue().contains("CampusConnect"));
        assertTrue(messageCaptor.getValue().matches("(?s).*\\b\\d{6}\\b.*"));
        assertTrue(messageCaptor.getValue().contains("10 minutes"));
        assertTrue(messageCaptor.getValue().toLowerCase().contains("share"));
        assertEquals("bcrypt-hash", codeCaptor.getValue().getCodeHash());
        assertTrue(codeCaptor.getValue().getExpiresAt().isAfter(LocalDateTime.now().plusMinutes(9)));
    }

    @Test
    void requestCodeReplacesAnOlderCodeAfterCooldown() {
        PasswordResetCode oldCode = createResetCode();
        oldCode.setCodeHash("old-hash");
        oldCode.setCreatedAt(LocalDateTime.now().minusSeconds(61));
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(new User()));
        when(resetCodeRepository.findByEmail(EMAIL)).thenReturn(Optional.of(oldCode), Optional.of(oldCode));
        when(passwordEncoder.encode(anyString())).thenReturn("new-hash");
        when(emailService.send(anyString(), anyString(), anyString(), anyString())).thenReturn(true);

        passwordResetService.requestCode(EMAIL);

        assertEquals("new-hash", oldCode.getCodeHash());
        assertEquals(0, oldCode.getAttempts());
        verify(resetCodeRepository).save(oldCode);
        verify(emailService).send(org.mockito.ArgumentMatchers.eq(EMAIL), anyString(), anyString(), anyString());
    }

    @Test
    void verifyCodeRejectsIncorrectCodeAndCountsAttempts() {
        PasswordResetCode resetCode = createResetCode();
        when(resetCodeRepository.findByEmail(EMAIL)).thenReturn(Optional.of(resetCode));
        when(passwordEncoder.matches("123456", "stored-hash")).thenReturn(false);

        assertThrows(IllegalArgumentException.class, () -> passwordResetService.verifyCode(EMAIL, "123456"));

        assertEquals(1, resetCode.getAttempts());
        verify(resetCodeRepository).save(resetCode);
    }

    @Test
    void verifyCodeRejectsExpiredCodeAndDeletesIt() {
        PasswordResetCode resetCode = createResetCode();
        resetCode.setExpiresAt(LocalDateTime.now().minusSeconds(1));
        when(resetCodeRepository.findByEmail(EMAIL)).thenReturn(Optional.of(resetCode));

        assertThrows(IllegalArgumentException.class, () -> passwordResetService.verifyCode(EMAIL, "123456"));

        verify(resetCodeRepository).delete(resetCode);
    }

    @Test
    void verifyCodeDeletesCodeAfterFifthIncorrectAttempt() {
        PasswordResetCode resetCode = createResetCode();
        resetCode.setAttempts(4);
        when(resetCodeRepository.findByEmail(EMAIL)).thenReturn(Optional.of(resetCode));
        when(passwordEncoder.matches("123456", "stored-hash")).thenReturn(false);

        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> passwordResetService.verifyCode(EMAIL, "123456"));

        assertEquals("Too many attempts. Request a new code.", exception.getMessage());
        verify(resetCodeRepository).delete(resetCode);
    }

    @Test
    void resetPasswordUpdatesHashAndConsumesCode() {
        PasswordResetCode resetCode = createResetCode();
        User user = new User();
        user.setEmail(EMAIL);
        user.setPasswordHash("old-hash");
        when(resetCodeRepository.findByEmail(EMAIL)).thenReturn(Optional.of(resetCode), Optional.empty());
        when(passwordEncoder.matches("123456", "stored-hash")).thenReturn(true);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("NewPassword123!")).thenReturn("new-hash");

        passwordResetService.resetPassword(EMAIL, "123456", "NewPassword123!");

        assertEquals("new-hash", user.getPasswordHash());
        // A reset changes only the password, never email verification.
        assertTrue(user.isEmailVerified());
        verify(userRepository).save(user);
        verify(resetCodeRepository).delete(resetCode);
        assertThrows(IllegalArgumentException.class,
            () -> passwordResetService.resetPassword(EMAIL, "123456", "NewPassword123!"));
    }

    @Test void resetDoesNotVerifyAnUnverifiedAccount() {
        PasswordResetCode code = createResetCode(); User user = new User(); user.setEmailVerified(false);
        when(resetCodeRepository.findByEmail(EMAIL)).thenReturn(Optional.of(code));
        when(passwordEncoder.matches("123456", "stored-hash")).thenReturn(true);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("NewPassword123!")).thenReturn("new-hash");
        passwordResetService.resetPassword(EMAIL, "123456", "NewPassword123!");
        org.junit.jupiter.api.Assertions.assertFalse(user.isEmailVerified());
    }

    @Test void failedDeliveryRemovesUndeliveredResetCode() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(new User()));
        when(resetCodeRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hash");
        passwordResetService.requestCode(EMAIL);
        verify(resetCodeRepository).delete(any(PasswordResetCode.class));
    }

    private PasswordResetCode createResetCode() {
        PasswordResetCode resetCode = new PasswordResetCode();
        resetCode.setEmail(EMAIL);
        resetCode.setCodeHash("stored-hash");
        resetCode.setExpiresAt(LocalDateTime.now().plusMinutes(10));
        resetCode.setCreatedAt(LocalDateTime.now().minusMinutes(2));
        resetCode.setAttempts(0);
        return resetCode;
    }
}
