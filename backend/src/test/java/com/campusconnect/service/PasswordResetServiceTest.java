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
    private JavaMailSender mailSender;

    @InjectMocks
    private PasswordResetService passwordResetService;

    @Test
    void requestCodeDoesNotDiscloseUnknownAccounts() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());

        passwordResetService.requestCode(EMAIL);

        verifyNoInteractions(resetCodeRepository, passwordEncoder, mailSender);
    }

    @Test
    void requestCodeEmailsCodeAndStoresOnlyItsHash() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(new User()));
        when(resetCodeRepository.findByEmail(EMAIL)).thenReturn(Optional.empty(), Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("bcrypt-hash");
        ReflectionTestUtils.setField(passwordResetService, "fromAddress", "saneledlomo08@gmail.com");
        ArgumentCaptor<SimpleMailMessage> messageCaptor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        ArgumentCaptor<PasswordResetCode> codeCaptor = ArgumentCaptor.forClass(PasswordResetCode.class);

        passwordResetService.requestCode(EMAIL);

        verify(mailSender).send(messageCaptor.capture());
        verify(resetCodeRepository).save(codeCaptor.capture());
        assertEquals(EMAIL, messageCaptor.getValue().getTo()[0]);
        assertTrue(messageCaptor.getValue().getText().contains("CampusConnect"));
        assertTrue(messageCaptor.getValue().getText().matches("(?s).*\\b\\d{6}\\b.*"));
        assertTrue(messageCaptor.getValue().getText().contains("10 minutes"));
        assertTrue(messageCaptor.getValue().getText().toLowerCase().contains("share"));
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
        ReflectionTestUtils.setField(passwordResetService, "fromAddress", "saneledlomo08@gmail.com");

        passwordResetService.requestCode(EMAIL);

        assertEquals("new-hash", oldCode.getCodeHash());
        assertEquals(0, oldCode.getAttempts());
        verify(resetCodeRepository).save(oldCode);
        verify(mailSender).send(any(SimpleMailMessage.class));
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
        verify(userRepository).save(user);
        verify(resetCodeRepository).delete(resetCode);
        assertThrows(IllegalArgumentException.class,
            () -> passwordResetService.resetPassword(EMAIL, "123456", "NewPassword123!"));
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