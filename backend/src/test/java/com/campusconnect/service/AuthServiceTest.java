package com.campusconnect.service;

import com.campusconnect.dto.RegisterRequest;
import com.campusconnect.entity.Driver;
import com.campusconnect.entity.User;
import com.campusconnect.repository.DriverRepository;
import com.campusconnect.repository.UserRepository;
import com.campusconnect.security.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private DriverRepository driverRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @InjectMocks
    private AuthService authService;

    @Test
    void register_acceptsRiderRoleAlias() {
        RegisterRequest request = new RegisterRequest();
        request.setFullName("Test User");
        request.setEmail("test@spu.ac.za");
        request.setPassword("Password123!");
        request.setRole("RIDER");
        request.setYearOfStudy(1);
        request.setEmergencyContact("1234567890");
        request.setStudentNumber("20240001");
        request.setPhone("1234567890");

        when(userRepository.existsByEmail("test@spu.ac.za")).thenReturn(false);
        when(passwordEncoder.encode("Password123!")).thenReturn("hashed-password");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User savedUser = authService.register(request);

        assertEquals(User.Role.RIDER, savedUser.getRole());
    }

    @Test
    void register_driverStartsPendingAndCreatesApprovalRecord() {
        RegisterRequest request = new RegisterRequest();
        request.setFullName("Driver User");
        request.setEmail("driver@spu.ac.za");
        request.setPassword("Password123!");
        request.setRole("DRIVER");
        request.setYearOfStudy(2);
        request.setEmergencyContact("1234567890");
        request.setStudentNumber("20240002");
        request.setPhone("1234567890");
        request.setLicencePlate("ABC123GP");
        request.setVehicleMake("Toyota");
        request.setVehicleYear(2023);

        when(userRepository.existsByEmail("driver@spu.ac.za")).thenReturn(false);
        when(passwordEncoder.encode("Password123!")).thenReturn("hashed-password");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(99L);
            return user;
        });
        when(driverRepository.save(any(Driver.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User savedUser = authService.register(request);

        assertEquals(User.Role.DRIVER, savedUser.getRole());
        assertEquals(User.UserStatus.PENDING, savedUser.getStatus());
        verify(driverRepository).save(any(Driver.class));
    }
}
