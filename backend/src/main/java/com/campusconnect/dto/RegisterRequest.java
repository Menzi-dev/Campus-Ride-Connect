package com.campusconnect.dto;

public class RegisterRequest {
	private String fullName;
	private String email;
	private String password;
	private String role;
	private Integer yearOfStudy;
	private String emergencyContact;
	private String studentNumber;
	private String phone;
	private String licencePlate;
	private String vehicleMake;
	private Integer vehicleYear;
	private Boolean faceVerified;
	private String faceEmbedding;

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

	public String getPassword() {
		return password;
	}

	public void setPassword(String password) {
		this.password = password;
	}

	public String getRole() {
		return role;
	}

	public void setRole(String role) {
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
}