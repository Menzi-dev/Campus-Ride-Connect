package com.campusconnect.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

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

	@Column(name = "password_hash", nullable = false)
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

	@Column(name = "licence_plate")
	private String licencePlate;

	@Column(name = "vehicle_make")
	private String vehicleMake;

	@Column(name = "vehicle_year")
	private Integer vehicleYear;

	@Column(name = "face_verified")
	private Boolean faceVerified = false;

	@Column(name = "face_embedding", columnDefinition = "TEXT")
	private String faceEmbedding;

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