// API access configuration: use BCrypt passwords, check JWT-authenticated requests, restrict
// administrator/security routes and allow the configured development browser origins.
// Where: passwordEncoder(), filterChain() and corsConfigurationSource() in this file.
// How: Spring uses these beans to check password hashes, apply API role rules, run
// JwtAuthenticationFilter and allow the configured browser origins.
package com.campusconnect.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/** Configures stateless JWT authentication, role restrictions and allowed development web origins. */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Autowired
    private JwtAuthenticationFilter jwtAuthFilter;

    // Feature: Provide the BCrypt encoder used to hash passwords and check login passwords.
    // Where: SecurityConfig.passwordEncoder() below.
    // How: passwordEncoder() returns BCryptPasswordEncoder. AuthService uses its encode()/matches()
    // methods instead of storing or comparing a plain password.
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // Feature: Define public and protected API routes and add the JWT filter before normal
    // authentication checks.
    // Where: SecurityConfig.filterChain() below.
    // How: filterChain() configures requestMatchers() for public/admin/security paths, stateless
    // sessions and jwtAuthFilter. The filter runs before UsernamePasswordAuthenticationFilter.
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/error", "/api/auth/login", "/api/auth/**", "/api/test/**", "/api/verification/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/security/**").hasRole("SECURITY")
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    // Feature: Allow the listed local browser origins, HTTP methods and request headers during
    // development.
    // Where: SecurityConfig.corsConfigurationSource() below.
    // How: corsConfigurationSource() sets the listed origins, methods and headers on
    // CorsConfiguration and registers it for /**. Browsers use these rules when calling the backend
    // from another origin.
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        // Allow local previews and the current LAN web preview on its Expo port.
        // This is important for Expo web / VS Code mobile preview, where the host may be
        // localhost:19002, 127.0.0.1:19002, or a similar local development address.
        configuration.setAllowedOriginPatterns(List.of(
            "http://localhost:*",
            "http://127.0.0.1:*",
            "http://10.0.2.2:*",
            "http://10.3.15.95:8081",
            "http://[::1]:*"
        ));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
