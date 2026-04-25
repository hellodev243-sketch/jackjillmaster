// API endpoint to send verification code
import { NextRequest, NextResponse } from "next/server";
import {
	generateVerificationCode,
	storeVerificationCode,
	sendVerificationEmail,
} from "@/lib/email";
import { gcsHelpers } from "@/lib/gcs-client";
import type { AdminUser } from "@/lib/admin-types";

export async function POST(request: NextRequest) {
	try {
		const { email } = await request.json();

		if (!email) {
			return NextResponse.json(
				{ success: false, error: "Email is required" },
				{ status: 400 },
			);
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return NextResponse.json(
				{ success: false, error: "Invalid email format" },
				{ status: 400 },
			);
		}

		const emailLower = email.toLowerCase().trim();

		// Check if email already registered (multi-admin)
		const admins: AdminUser[] = await gcsHelpers.getAdminsIndex();
		if (admins.find((a) => a.email.toLowerCase() === emailLower)) {
			return NextResponse.json(
				{
					success: false,
					error: "An account with this email already exists. Please sign in instead.",
				},
				{ status: 409 },
			);
		}

		// Check legacy admin
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

		// Generate and store verification code
		const code = generateVerificationCode();
		storeVerificationCode(email, code);

		// Send verification email
		const result = await sendVerificationEmail(email, code);

		if (!result.success) {
			return NextResponse.json(
				{
					success: false,
					error: result.error || "Failed to send verification email",
				},
				{ status: 500 },
			);
		}

		return NextResponse.json({
			success: true,
			message: "Verification code sent successfully",
		});
	} catch (error) {
		console.error("[API] Send verification error:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json(
			{
				success: false,
				error: `Failed to send verification code: ${errorMessage}`,
			},
			{ status: 500 },
		);
	}
}
