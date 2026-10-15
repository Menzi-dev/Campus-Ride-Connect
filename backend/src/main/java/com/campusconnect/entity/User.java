// Database record: store account details, password hash, role, profile and enrollment/verification
// state. The annotations map these fields to table columns; the methods below read and update the
// record.
// Where: User in this file maps to the users table.
// How: @Id identifies its record and @Column/@Enumerated define field storage. Repository/service
// code reads and updates these fields through the methods below.
package com.campusconnect.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Maps account credentials, role, profile, face enrollment and email-verification state. */
@Entity
@Table(name = "users")
public class User {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "user_id")
	private Long id;

	@Column(name = "full_name")
	private String fullName;

	@Column(unique = true, nullable = false)
	private String email;

	// NULL means a pre-verification legacy account; new registration explicitly sets false.
	@Column(name = "email_verified")
	@com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
	private Boolean emailVerified;

	public boolean isEmailVerified() { return !Boolean.FALSE.equals(emailVerified); }
	@com.fasterxml.jackson.annotation.JsonIgnore
	public boolean requiresEmailVerification() { return role != Role.DRIVER && !isEmailVerified(); }
	public void setEmailVerified(Boolean value) { emailVerified = value; }

	// Feature: Store the password hash for login checks and hide it from JSON responses.
	// The role below identifies the account's rider, driver, admin or security access.
	// Where: passwordHash and role below map to users.password_hash and users.role.
	// How: AuthService uses BCrypt encode()/matches(); JwtTokenProvider puts the role in
	// the token and JwtAuthenticationFilter makes it available to Spring access checks.
	@Column(name = "password_hash", nullable = false)
	@com.fasterxml.jackson.annotation.JsonIgnore
	private String passwordHash;

	@Enumerated(EnumType.STRING)
	@Column(name = "role", nullable = false)
	private Role role;

	@Column(name = "year_of_study")
	private Integer yearOfStudy;

	@Column(name = "emergency_contact")
	private String emergencyContact;

	@Column(name = "student_number")
	private String studentNumber;

	@Column(name = "phone")
	private String phone;

	@Column(name = "profile_photo", columnDefinition = "LONGTEXT")
	private String profilePhoto;

	@Column(name = "licence_plate")
	private String licencePlate;

	@Column(name = "vehicle_make")
	private String vehicleMake;

	@Column(name = "vehicle_year")
	private Integer vehicleYear;

	// Feature: Keep enrollment data separately from the public profile. A saved enrollment
	// photo is a comparison reference; it does not by itself prove the user's identity.
	// Where: faceEnrollmentPhoto, faceEmbedding and faceScanMetadata below.
	// How: registration saves the enrollment. RideFaceVerificationService reads its image
	// for Python comparison; @JsonIgnore keeps these private fields out of normal JSON output.
	@Column(name = "face_verified")
	private Boolean faceVerified = false;

	@Column(name = "face_embedding", columnDefinition = "TEXT")
	@com.fasterxml.jackson.annotation.JsonIgnore
	private String faceEmbedding;

	@com.fasterxml.jackson.annotation.JsonIgnore
	@Column(name = "face_enrollment_photo", columnDefinition = "LONGTEXT")
	private String faceEnrollmentPhoto;

	@com.fasterxml.jackson.annotation.JsonIgnore
	@Column(name = "face_scan_metadata", columnDefinition = "TEXT")
	private String faceScanMetadata;
	@com.fasterxml.jackson.annotation.JsonIgnore
	@Column(name = "application_documents", columnDefinition = "LONGTEXT")
	private String applicationDocuments;
	public String getApplicationDocuments() { return applicationDocuments; }
	public void setApplicationDocuments(String value) { applicationDocuments = value; }

	public String getFaceEnrollmentPhoto() { return faceEnrollmentPhoto; }
	public void setFaceEnrollmentPhoto(String value) { faceEnrollmentPhoto = value; }
	public String getFaceScanMetadata() { return faceScanMetadata; }
	public void setFaceScanMetadata(String value) { faceScanMetadata = value; }

	@Enumerated(EnumType.STRING)
	@Column(name = "status")
	private UserStatus status;

	@Column(name = "created_at")
	private LocalDateTime createdAt;

	public enum Role {
		RIDER,
		DRIVER,
		ADMIN,
		SECURITY
	}

	public enum UserStatus {
		ACTIVE,
		PENDING,
		SUSPENDED
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getFullName() {
		return fullName;
	}

	public void setFullName(String fullName) {
		this.fullName = fullName;
	}

	public String getEmail() {
		return email;
	}

	public void setEmail(String email) {
		this.email = email;
	}

	public String getPasswordHash() {
		return passwordHash;
	}

	public void setPasswordHash(String passwordHash) {
		this.passwordHash = passwordHash;
	}

	public Role getRole() {
		return role;
	}

	public void setRole(Role role) {
		this.role = role;
	}

	public Integer getYearOfStudy() {
		return yearOfStudy;
	}

	public void setYearOfStudy(Integer yearOfStudy) {
		this.yearOfStudy = yearOfStudy;
	}

	public String getEmergencyContact() {
		return emergencyContact;
	}

	public void setEmergencyContact(String emergencyContact) {
		this.emergencyContact = emergencyContact;
	}

	public String getStudentNumber() {
		return studentNumber;
	}

	public void setStudentNumber(String studentNumber) {
		this.studentNumber = studentNumber;
	}

	public String getPhone() {
		return phone;
	}

	public void setPhone(String phone) {
		this.phone = phone;
	}

	public String getProfilePhoto() {
		return profilePhoto;
	}

	public void setProfilePhoto(String profilePhoto) {
		this.profilePhoto = profilePhoto;
	}

	public String getLicencePlate() {
		return licencePlate;
	}

	public void setLicencePlate(String licencePlate) {
		this.licencePlate = licencePlate;
	}

	public String getVehicleMake() {
		return vehicleMake;
	}

	public void setVehicleMake(String vehicleMake) {
		this.vehicleMake = vehicleMake;
	}

	public Integer getVehicleYear() {
		return vehicleYear;
	}

	public void setVehicleYear(Integer vehicleYear) {
		this.vehicleYear = vehicleYear;
	}

	public Boolean getFaceVerified() {
		return faceVerified;
	}

	public void setFaceVerified(Boolean faceVerified) {
		this.faceVerified = faceVerified;
	}

	public String getFaceEmbedding() {
		return faceEmbedding;
	}

	public void setFaceEmbedding(String faceEmbedding) {
		this.faceEmbedding = faceEmbedding;
	}

	public UserStatus getStatus() {
		return status;
	}

	public void setStatus(UserStatus status) {
		this.status = status;
	}

	public LocalDateTime getCreatedAt() {
		return createdAt;
	}

	public void setCreatedAt(LocalDateTime createdAt) {
		this.createdAt = createdAt;
	}
}
