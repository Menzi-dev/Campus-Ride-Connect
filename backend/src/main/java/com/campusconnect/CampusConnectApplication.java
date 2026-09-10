package com.campusconnect;

import com.campusconnect.entity.User;
import com.campusconnect.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;

@SpringBootApplication
public class CampusConnectApplication {
    public static void main(String[] args) {
        SpringApplication.run(CampusConnectApplication.class, args);
    }

    @Bean
    public CommandLineRunner seedAdmin(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            String adminEmail = "admin@spu.ac.za";
            User admin = userRepository.findByEmail(adminEmail).orElse(null);
            if (admin == null) {
                admin = new User();
                admin.setFullName("University Admin");
                admin.setEmail(adminEmail);
                admin.setStatus(User.UserStatus.ACTIVE);
                admin.setCreatedAt(LocalDateTime.now());
            }
            admin.setPasswordHash(passwordEncoder.encode("SANELEDLOMO@2005"));
            admin.setRole(User.Role.ADMIN);
            admin.setStatus(User.UserStatus.ACTIVE);
            if (admin.getCreatedAt() == null) {
                admin.setCreatedAt(LocalDateTime.now());
            }
            userRepository.save(admin);
        };
    }

    @Bean
    public CommandLineRunner repairRideSchema(JdbcTemplate jdbcTemplate) {
        return args -> {
            ensureRideColumn(jdbcTemplate, "rider_rating", "INT NULL");
            ensureRideColumn(jdbcTemplate, "rider_rating_comment", "VARCHAR(500) NULL");
            ensureCashPaymentMethod(jdbcTemplate);
        };
    }

    private void ensureCashPaymentMethod(JdbcTemplate jdbcTemplate) {
        try {
            jdbcTemplate.execute("ALTER TABLE payments MODIFY COLUMN method "
                    + "ENUM('CAMPUS_WALLET','CARD','MOBILE_MONEY','CASH') NOT NULL");
        } catch (Exception ignored) {
            // The payments table may not exist in a fresh database yet.
        }
    }

    private void ensureRideColumn(JdbcTemplate jdbcTemplate, String columnName, String definition) {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM information_schema.columns "
                + "WHERE table_schema = DATABASE() AND table_name = 'rides' AND column_name = ?",
            Integer.class,
            columnName
        );
        if (count != null && count == 0) {
            jdbcTemplate.execute("ALTER TABLE rides ADD COLUMN " + columnName + " " + definition);
        }
    }
}
