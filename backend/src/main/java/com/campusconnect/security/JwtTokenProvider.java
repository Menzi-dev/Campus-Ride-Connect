// Login tokens: create signed JWTs and read their user and role claims after validation.
// Where: generateToken(), validateToken() and parseClaims() in security/JwtTokenProvider.java.
// How: JJWT signs/reads tokens using the configured key; the token user/role claims are used by
// JwtAuthenticationFilter.
package com.campusconnect.security;

import com.campusconnect.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/** Creates, validates and reads JWT claims using the configured signing secret and expiry. */
@Component
public class JwtTokenProvider {

    @Value("${app.jwt.secret:${jwt.secret:changeitchangemechangekey1234567890}}")
    private String secret;

    @Value("${app.jwt.expiration-ms:${jwt.expiration:604800000}}")
    private long expirationMs;

    private SecretKey key;

    @PostConstruct
    public void init() {
        key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    // Feature: Create a signed session token containing the account identifier and role.
    // Where: JwtTokenProvider.generateToken() below.
    // How: generateToken() uses now.getTime(), Jwts.builder() and String.valueOf() to build/check
    // the result returned by the code below.
    public String generateToken(User user) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .setSubject(String.valueOf(user.getId()))
                .claim("email", user.getEmail())
                .claim("role", user.getRole() != null ? user.getRole().name() : null)
                .setIssuedAt(now)
                .setExpiration(expiryDate)
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    // Feature: Parse the token and reject an invalid signature, expired token or other token error.
    // Where: JwtTokenProvider.validateToken() below.
    // How: validateToken() uses Jwts.parser() to build/check the result returned by the code below.
    public boolean validateToken(String token) {
        try {
            Jwts.parser().setSigningKey(key).build().parseClaimsJws(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public String getUserIdFromToken(String token) {
        return parseClaims(token).getSubject();
    }

    public String getRoleFromToken(String token) {
        return parseClaims(token).get("role", String.class);
    }

    // Feature: Read verified token claims using the configured signing key.
    // Where: JwtTokenProvider.parseClaims() below.
    // How: parseClaims() uses Jwts.parser() and jws.getBody() to build/check the result returned by
    // the code below.
    private Claims parseClaims(String token) {
        Jws<Claims> jws = Jwts.parser().setSigningKey(key).build().parseClaimsJws(token);
        return jws.getBody();
    }
}