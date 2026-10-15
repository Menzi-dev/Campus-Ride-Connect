// Test feature: check persistent email configuration behaviour using the cases below. Use the
// fixtures and any mocked dependencies defined here to exercise success and failure cases.
// Where: PersistentEmailConfigurationTest in this file, including
// privatePropertiesAreLoadedOnTwoIndependentStartsWithGmailTlsSettings().
// How: JUnit executes the test methods. Fixtures and any Mockito mocks in this class provide
// controlled inputs; assertions check the returned values, errors or saved interactions.
package com.campusconnect.service;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.WebApplicationType;
import org.springframework.context.annotation.Configuration;
import java.nio.file.Path;
import java.nio.file.Files;
import static org.junit.jupiter.api.Assertions.*;
class PersistentEmailConfigurationTest {
    @Configuration(proxyBeanMethods = false) static class Config {}
    @TempDir Path directory;
    @Test void privatePropertiesAreLoadedOnTwoIndependentStartsWithGmailTlsSettings() throws Exception {
        Path file = directory.resolve("mail.properties");
        Files.writeString(file, "GMAIL_USERNAME=fixture@example.com\nGMAIL_APP_PASSWORD=fixture-only-not-a-real-password\nAPP_PUBLIC_URL=https://fixture.example\n");
        Path application = directory.resolve("application.yml");
        // Load the real production configuration, without the test suite's fixed public URL override.
        Files.copy(Path.of("src/main/resources/application.yml"), application);
        for (int start = 0; start < 2; start++) {
            try (var context = new SpringApplicationBuilder(Config.class).web(WebApplicationType.NONE).run(
                "--spring.config.location=" + application.toUri(), "--spring.config.import=" + file.toUri(),
                "--spring.main.banner-mode=off", "--logging.level.root=WARN", "--logging.level.org.springframework=WARN")) {
                var env = context.getEnvironment();
                assertEquals("fixture-only-not-a-real-password", env.getProperty("spring.mail.password"));
                assertEquals("fixture@example.com", env.getProperty("spring.mail.username"));
                assertEquals("smtp.gmail.com", env.getProperty("spring.mail.host"));
                assertEquals("587", env.getProperty("spring.mail.port"));
                assertEquals("true", env.getProperty("spring.mail.properties.mail.smtp.starttls.required"));
                assertEquals("https://fixture.example", env.getProperty("app.public-url"));
            }
        }
    }
}
