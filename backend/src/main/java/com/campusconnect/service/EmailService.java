// Email delivery: check mail configuration and send plain-text and HTML messages through Spring
// mail. Return whether delivery was accepted by the configured sender.
// Where: EmailService, starting with configured() and send() in this file.
// How: The calling controller/service uses these methods. Their named mail, repository or other
// helper calls perform the work described below.
package com.campusconnect.service;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

/** Checks mail configuration and sends plain-text and HTML application emails through the configured SMTP sender. */
@Service
public class EmailService {
    private static final Logger LOG = LoggerFactory.getLogger(EmailService.class);
    private final JavaMailSender sender;
    @Value("${spring.mail.username:}") private String username;
    @Value("${spring.mail.password:}") private String password;
    @Value("${spring.mail.host:}") private String host;
    @Value("${spring.mail.port:587}") private int port;
    @Value("${app.mail.required:false}") private boolean required;
    @Value("${app.mail.disabled:false}") private boolean disabled;

    public EmailService(JavaMailSender sender) { this.sender = sender; }

    @PostConstruct
    public void diagnoseConfiguration() {
        if (disabled) { LOG.info("Email sending is disabled (test configuration)."); return; }
        if (!configured()) {
            String message = "Email configuration missing: set GMAIL_APP_PASSWORD in the private mail.properties file. "
                + "Run backend/configure-email.ps1 once; backend/run-with-gmail.ps1 then loads it on every start.";
            if (required) throw new IllegalStateException(message);
            LOG.warn(message);
        } else {
            LOG.info("SMTP settings loaded: host={}, port={}. Credentials are present; delivery is not yet tested.", host, port);
        }
    }

    // Feature: Check whether the required mail sender settings are available.
    // Where: EmailService.configured() below.
    // How: configured() uses username.isBlank(), password.isBlank() and password.contains() to
    // build/check the result returned by the code below.
    public boolean configured() {
        return !disabled && username != null && !username.isBlank() && password != null && !password.isBlank()
            && !password.contains("YOUR_") && host != null && !host.isBlank();
    }

    // Feature: Build a plain-text/HTML email and attempt delivery through the configured mail
    // sender.
    // Where: EmailService.send() below.
    // How: send() calls configured() in this class to carry out the operation. Any failed checks
    // stop the operation with the exception shown below.
    public boolean send(String recipient, String subject, String text, String html) {
        if (!configured()) { LOG.warn("Email delivery skipped: SMTP credentials are missing or email is disabled."); return false; }
        try {
            var message = sender.createMimeMessage();
            var helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(username, "CampusConnect");
            helper.setTo(recipient);
            helper.setSubject(subject);
            helper.setText(text, html);
            sender.send(message);
            LOG.info("Email accepted by SMTP: category={}", subject);
            return true;
        } catch (Exception error) {
            // Do not log the exception/message: mail exceptions can contain complete mail bodies and tokens.
            boolean authentication = error instanceof MailAuthenticationException;
            Throwable cause = error;
            while (cause != null) {
                authentication |= cause instanceof jakarta.mail.AuthenticationFailedException;
                cause = cause.getCause();
            }
            LOG.warn("Email delivery failed: category={}, cause={}. {}", subject,
                error.getClass().getSimpleName(), authentication
                    ? "Check the existing Gmail App Password and sender account; restarting does not revoke it."
                    : "Check SMTP host/port, network access, TLS and provider availability.");
            return false;
        }
    }

    public static String page(String title, String body) {
        return "<!doctype html><html><body style=\"font-family:Arial,sans-serif;background:#f6f8fa;padding:24px\">"
            + "<div style=\"max-width:560px;margin:auto;background:white;padding:28px;border-radius:16px\">"
            + "<h2 style=\"color:#16a34a\">CampusConnect</h2><h3>" + escape(title) + "</h3>" + body + "</div></body></html>";
    }
    public static String escape(String text) { return HtmlUtils.htmlEscape(text); }
}
