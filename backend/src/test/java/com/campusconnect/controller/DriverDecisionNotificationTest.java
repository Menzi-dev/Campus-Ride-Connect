// Test feature: check driver decision notification behaviour using the cases below. Use the
// fixtures and any mocked dependencies defined here to exercise success and failure cases.
// Where: DriverDecisionNotificationTest in this file, including
// changedApprovalEnqueuesExactlyOneNotification() and
// rejectedApplicationEnqueuesRejectionWithoutVerifyingEmail().
// How: JUnit executes the test methods. Fixtures and any Mockito mocks in this class provide
// controlled inputs; assertions check the returned values, errors or saved interactions.
package com.campusconnect.controller;
import com.campusconnect.entity.*;
import com.campusconnect.repository.*;
import com.campusconnect.service.DriverDecisionEmailService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.Optional;
import static org.mockito.Mockito.*;
class DriverDecisionNotificationTest {
    private final UserRepository users = mock(UserRepository.class);
    private final DriverRepository drivers = mock(DriverRepository.class);
    private final DriverDecisionEmailService emails = mock(DriverDecisionEmailService.class);
    private final AdminController controller = new AdminController(users, mock(RideRepository.class), drivers, mock(JdbcTemplate.class), emails);
    @Test void changedApprovalEnqueuesExactlyOneNotification() {
        Driver driver = new Driver(); driver.setUserId(9L); driver.setApprovalStatus(Driver.ApprovalStatus.PENDING);
        User user = new User(); user.setId(9L);
        when(drivers.findByIdForUpdate(5L)).thenReturn(Optional.of(driver));
        when(users.findById(9L)).thenReturn(Optional.of(user));
        controller.approveDriver(5L); controller.approveDriver(5L);
        verify(emails).enqueue(user, Driver.ApprovalStatus.APPROVED);
    }
    @Test void rejectedApplicationEnqueuesRejectionWithoutVerifyingEmail() {
        Driver driver = new Driver(); driver.setUserId(9L); driver.setApprovalStatus(Driver.ApprovalStatus.PENDING);
        User user = new User(); user.setId(9L); user.setEmailVerified(false);
        when(drivers.findByIdForUpdate(5L)).thenReturn(Optional.of(driver));
        when(users.findById(9L)).thenReturn(Optional.of(user));
        controller.rejectDriver(5L); verify(emails).enqueue(user, Driver.ApprovalStatus.REJECTED);
        org.junit.jupiter.api.Assertions.assertFalse(user.isEmailVerified());
    }
}
