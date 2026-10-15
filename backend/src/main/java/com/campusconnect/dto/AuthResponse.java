// Login result: return the generated session token and account data to the client.
// Where: AuthResponse fields and getters/setters in this file.
// How: Spring/Jackson reads or writes JSON using these properties. Controllers pass request objects
// into services or return the response object to the client.
package com.campusconnect.dto;

import com.campusconnect.entity.User;

/** Returns the issued token and account information needed for role-based client navigation. */
public class AuthResponse {
	private String token;
	private User user;

	public String getToken() {
		return token;
	}

	public void setToken(String token) {
		this.token = token;
	}

	public User getUser() {
		return user;
	}

	public void setUser(User user) {
		this.user = user;
	}
}
