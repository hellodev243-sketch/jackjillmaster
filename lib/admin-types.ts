// Multi-Admin type definitions for the Jack & Jill Competition System

export interface AdminUser {
	id: string;
	fullName: string;
	email: string;
	passwordHash: string;
	organizationName: string;
	danceStyle: string;
	expectedCompetitors: number;
	verified: boolean;
	createdAt: string;
	trialExpiresAt: string; // 7 days from registration
}

export interface PasswordResetToken {
	token: string;
	email: string;
	expiresAt: number; // Unix timestamp
}

// Admin profile data returned to the client (no passwordHash)
export interface AdminProfile {
	id: string;
	fullName: string;
	email: string;
	organizationName: string;
	danceStyle: string;
	expectedCompetitors: number;
	verified: boolean;
	createdAt: string;
	trialExpiresAt: string;
}
