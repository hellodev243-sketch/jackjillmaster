// Admin Registration API Route
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { gcsHelpers } from "@/lib/gcs-client";
import { sendAdminRegistrationEmail } from "@/lib/email";
import type { AdminUser } from "@/lib/admin-types";

export async function POST(request: NextRequest) {
	try {
		const {
			fullName,
			email,
			password,
			organizationName,
			danceStyle,
			expectedCompetitors,
		} = await request.json();

		// Validate required fields
		if (!fullName || !email || !password || !organizationName) {
			return NextResponse.json(
				{
					success: false,
					error: "Full name, email, password, and organization name are required",
				},
				{ status: 400 },
			);
		}

		if (password.length < 6) {
			return NextResponse.json(
				{
					success: false,
					error: "Password must be at least 6 characters",
				},
				{ status: 400 },
			);
		}

		const emailLower = email.toLowerCase().trim();

		// Check if email already exists in multi-admin index
		const admins: AdminUser[] = await gcsHelpers.getAdminsIndex();
		const existingAdmin = admins.find(
			(a) => a.email.toLowerCase() === emailLower,
		);

		if (existingAdmin) {
			return NextResponse.json(
				{
					success: false,
					error: "An account with this email already exists",
				},
				{ status: 409 },
			);
		}

		// Also check legacy admin
		const legacyCredentials = await gcsHelpers.getAdminCredentials();
		if (
			legacyCredentials &&
			legacyCredentials.email.toLowerCase() === emailLower
		) {
			return NextResponse.json(
				{
					success: false,
					error: "An account with this email already exists. Please sign in instead.",
				},
				{ status: 409 },
			);
		}

		// Hash password
		const passwordHash = await bcrypt.hash(password, 12);

		// Generate unique admin ID
		const adminId = `admin-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

		// Calculate trial expiry (7 days from now)
		const trialExpiresAt = new Date(
			Date.now() + 7 * 24 * 60 * 60 * 1000,
		).toISOString();

		// Create admin user
		const newAdmin: AdminUser = {
			id: adminId,
			fullName: fullName.trim(),
			email: emailLower,
			passwordHash,
			organizationName: organizationName.trim(),
			danceStyle: danceStyle?.trim() || "",
			expectedCompetitors: parseInt(expectedCompetitors) || 0,
			verified: true, // Auto-verified for free trial
			createdAt: new Date().toISOString(),
			trialExpiresAt,
		};

		// Save to admins index
		admins.push(newAdmin);
		await gcsHelpers.saveAdminsIndex(admins);

		// Save individual admin profile
		await gcsHelpers.saveAdminProfile(adminId, newAdmin);

		// Send registration confirmation email (non-blocking)
		sendAdminRegistrationEmail(
			emailLower,
			fullName.trim(),
			organizationName.trim(),
		).catch((err) => {
			console.error("[API] Failed to send registration email:", err);
		});

		return NextResponse.json({
			success: true,
			adminId,
			message: "Registration successful",
		});
	} catch (error) {
		console.error("[API] Admin registration error:", error);
		return NextResponse.json(
			{ success: false, error: "Registration failed" },
			{ status: 500 },
		);
	}
}
