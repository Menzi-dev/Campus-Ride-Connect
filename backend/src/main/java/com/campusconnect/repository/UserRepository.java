// Database access: provide saved User lookups and updates for the services/controllers. Spring
// implements the named query methods; any written query defines a specific lookup.
// Where: UserRepository in this file; queries operate on the User entity in ../entity/User.java.
// How: JpaRepository supplies save/find/delete operations. Spring builds queries from names such as
// existsByEmail() and findByEmail(); @Query adds explicit queries where present.
package com.campusconnect.repository;

import com.campusconnect.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/** Provides Spring Data persistence queries for user accounts. */
public interface UserRepository extends JpaRepository<User, Long> {
    boolean existsByEmail(String email);
    Optional<User> findByEmail(String email);
    long countByRole(User.Role role);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select u from User u where u.email = :email")
    Optional<User> findByEmailForUpdate(@org.springframework.data.repository.query.Param("email") String email);
}
