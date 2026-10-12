package com.campusconnect.config;

import com.campusconnect.security.JwtTokenProvider;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.logging.Logger;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger LOGGER = Logger.getLogger(JwtAuthenticationFilter.class.getName());

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private com.campusconnect.repository.UserRepository userRepository;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        String header = request.getHeader("Authorization");
        LOGGER.info(() -> "Incoming request " + request.getMethod() + " " + request.getRequestURI() + " Authorization=" + (header != null ? "present" : "missing"));

        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);

            if (jwtTokenProvider.validateToken(token)) {
                String userId = jwtTokenProvider.getUserIdFromToken(token);
                String role = jwtTokenProvider.getRoleFromToken(token);
                var account = userRepository.findById(Long.valueOf(userId));
                if (account.isEmpty() || account.get().requiresEmailVerification()) {
                    SecurityContextHolder.clearContext();
                    response.setStatus(403);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"code\":\"EMAIL_NOT_VERIFIED\",\"error\":\"Verify your email before accessing the application\"}");
                    return;
                }
                LOGGER.info(() -> "JWT validated for userId=" + userId + ", role=" + role);

                List<GrantedAuthority> authorities = role != null
                        ? List.of(new SimpleGrantedAuthority("ROLE_" + role))
                        : List.of();

                var authentication = new UsernamePasswordAuthenticationToken(userId, null, authorities);
                SecurityContextHolder.getContext().setAuthentication(authentication);
                LOGGER.info(() -> "SecurityContext populated with authorities=" + authorities);
            } else {
                LOGGER.warning("JWT validation failed for token from request: " + request.getRequestURI());
            }
        } else {
            LOGGER.warning("Authorization header missing or malformed for request: " + request.getRequestURI());
        }

        filterChain.doFilter(request, response);
    }
}
