// Login data: carry the email and password received from the client to the login service.
// Where: AuthRequest fields and getters/setters in this file.
// How: Spring/Jackson reads or writes JSON using these properties. Controllers pass request objects
// into services or return the response object to the client.
package com.campusconnect.dto;

/** Carries login credentials from the HTTP request to authentication. */
public class AuthRequest {
	private String email;
	private String password;

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
}
