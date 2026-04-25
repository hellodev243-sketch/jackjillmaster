// Forgot Password API Route
import { NextRequest, NextResponse } from "next/server";
import { gcsHelpers } from "@/lib/gcs-client";
import { sendPasswordResetEmail } from "@/lib/email";
import type { AdminUser } from "@/lib/admin-types";
import type { PasswordResetToken } from "@/lib/admin-types";
import crypto from "crypto";

export async function POST(request: NextRequest) {
	try {
		const { email, baseUrl } = await request.json();

		if (!email) {
			return NextResponse.json(
				{ success: false, error: "Email is required" },
				{ status: 400 }
			);
		}

		const emailLower = email.toLowerCase().trim();
		const siteUrl =
			baseUrl || process.env.NEXT_PUBLIC_BASE_URL || "https://www.jacknjillsoftware.com";

		// Look up admin by email
		const admins: AdminUser[] = await gcsHelpers.getAdminsIndex();
		const admin = admins.find(
			(a) => a.email.toLowerCase() === emailLower
		);

		// Always return success to avoid email enumeration
		if (!admin) {
			return NextResponse.json({
				success: true,
				message: "If an account with that email exists, a reset link has been sent.",
			});
		}

		// Generate reset token
		const resetToken = crypto.randomUUID();
		const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

		// Save token
		const tokens: PasswordResetToken[] =
			await gcsHelpers.getPasswordResetTokens();

		// Remove any existing tokens for this email
		const filteredTokens = tokens.filter(
			(t) => t.email !== emailLower && t.expiresAt > Date.now()
		);

		filteredTokens.push({
			token: resetToken,
			email: emailLower,
			expiresAt,
		});

		await gcsHelpers.savePasswordResetTokens(filteredTokens);

		// Send reset email
		await sendPasswordResetEmail(emailLower, resetToken, siteUrl);

		return NextResponse.json({
			success: true,
			message: "If an account with that email exists, a reset link has been sent.",
		});
	} catch (error) {
		console.error("[API] Forgot password error:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to process request" },
			{ status: 500 }
		);
	}
}
