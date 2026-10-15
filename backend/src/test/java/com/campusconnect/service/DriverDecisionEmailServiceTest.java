// Test feature: check driver decision email service behaviour using the cases below. Use the
// fixtures and any mocked dependencies defined here to exercise success and failure cases.
// Where: DriverDecisionEmailServiceTest in this file, including
// approvalAndRejectionArePersistedWithoutSmtpDependency() and
// failedMailIsRetriedAndSuccessMarksSent().
// How: JUnit executes the test methods. Fixtures and any Mockito mocks in this class provide
// controlled inputs; assertions check the returned values, errors or saved interactions.
package com.campusconnect.service;
import com.campusconnect.entity.*;
import com.campusconnect.repository.DriverDecisionEmailRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.Instant;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class DriverDecisionEmailServiceTest {
    private final DriverDecisionEmailRepository queue = mock(DriverDecisionEmailRepository.class);
    private final EmailService email = mock(EmailService.class);
    private final DriverDecisionEmailService service = new DriverDecisionEmailService(queue, email);
    @Test void approvalAndRejectionArePersistedWithoutSmtpDependency() {
        User user = new User(); user.setEmail("driver@example.com"); user.setFullName("Test Driver");
        service.enqueue(user, Driver.ApprovalStatus.APPROVED); service.enqueue(user, Driver.ApprovalStatus.REJECTED);
        var captor = org.mockito.ArgumentCaptor.forClass(DriverDecisionEmail.class);
        verify(queue, times(2)).save(captor.capture());
        assertEquals("APPROVED", captor.getAllValues().get(0).getDecision());
        assertEquals("REJECTED", captor.getAllValues().get(1).getDecision()); verifyNoInteractions(email);
    }
    @Test void failedMailIsRetriedAndSuccessMarksSent() {
        var item = new DriverDecisionEmail(); item.setRecipient("driver@example.com"); item.setFullName("Driver"); item.setDecision("APPROVED");
        ReflectionTestUtils.setField(service, "publicUrl", "https://campus.example");
        when(email.configured()).thenReturn(true);
        when(queue.findTop10BySentAtIsNullAndNextAttemptAtLessThanEqualOrderByIdAsc(any())).thenReturn(List.of(item));
        when(email.send(anyString(), anyString(), anyString(), anyString())).thenReturn(false, true);
        service.deliverPending(); assertNull(item.getSentAt()); assertEquals(1, item.getAttempts());
        assertTrue(item.getNextAttemptAt().isAfter(Instant.now()));
        service.deliverPending(); assertNotNull(item.getSentAt());
    }
    @Test void missingCredentialsKeepQueueForNextRestart() {
        service.deliverPending(); verifyNoInteractions(queue);
    }
}
