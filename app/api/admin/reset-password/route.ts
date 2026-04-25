// Reset Password API Route
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { gcsHelpers } from "@/lib/gcs-client";
import type { AdminUser } from "@/lib/admin-types";
import type { PasswordResetToken } from "@/lib/admin-types";

export async function POST(request: NextRequest) {
	try {
		const { token, password } = await request.json();

		if (!token || !password) {
			return NextResponse.json(
				{ success: false, error: "Token and password are required" },
				{ status: 400 }
			);
		}

		if (password.length < 6) {
			return NextResponse.json(
				{
					success: false,
					error: "Password must be at least 6 characters",
				},
				{ status: 400 }
			);
		}

		// Get and validate token
		const tokens: PasswordResetToken[] =
			await gcsHelpers.getPasswordResetTokens();
		const resetToken = tokens.find((t) => t.token === token);

		if (!resetToken) {
			return NextResponse.json(
				{
					success: false,
					error: "Invalid or expired reset link. Please request a new one.",
				},
				{ status: 400 }
			);
		}

		if (resetToken.expiresAt < Date.now()) {
			// Remove expired token
			const filteredTokens = tokens.filter((t) => t.token !== token);
			await gcsHelpers.savePasswordResetTokens(filteredTokens);

			return NextResponse.json(
				{
					success: false,
					error: "This reset link has expired. Please request a new one.",
				},
				{ status: 400 }
			);
		}

		// Hash new password
		const passwordHash = await bcrypt.hash(password, 12);

		// Update admin's password
		const admins: AdminUser[] = await gcsHelpers.getAdminsIndex();
		const adminIndex = admins.findIndex(
			(a) => a.email.toLowerCase() === resetToken.email.toLowerCase()
		);

		if (adminIndex === -1) {
			return NextResponse.json(
				{ success: false, error: "Admin account not found" },
				{ status: 404 }
			);
		}

		admins[adminIndex].passwordHash = passwordHash;
		await gcsHelpers.saveAdminsIndex(admins);

		// Also update individual profile
		await gcsHelpers.saveAdminProfile(admins[adminIndex].id, admins[adminIndex]);

		// Invalidate the used token and clean up expired ones
		const remainingTokens = tokens.filter(
			(t) => t.token !== token && t.expiresAt > Date.now()
		);
		await gcsHelpers.savePasswordResetTokens(remainingTokens);

		return NextResponse.json({
			success: true,
			message: "Password has been reset successfully",
		});
	} catch (error) {
		console.error("[API] Reset password error:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to reset password" },
			{ status: 500 }
		);
	}
}
