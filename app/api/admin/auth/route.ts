// Admin Authentication API Route - Multi-admin support
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { gcsHelpers } from "@/lib/gcs-client";
import type { AdminUser, AdminProfile } from "@/lib/admin-types";

export async function POST(request: NextRequest) {
	try {
		const { email, password } = await request.json();

		if (!email || !password) {
			return NextResponse.json(
				{ success: false, error: "Email and password are required" },
				{ status: 400 }
			);
		}

		const emailLower = email.toLowerCase().trim();

		// Try multi-admin login first
		const admins: AdminUser[] = await gcsHelpers.getAdminsIndex();

		if (admins.length > 0) {
			const admin = admins.find(
				(a) => a.email.toLowerCase() === emailLower
			);

			if (admin) {
				const isValid = await bcrypt.compare(
					password,
					admin.passwordHash
				);

				if (!isValid) {
					return NextResponse.json(
						{
							success: false,
							error: "Invalid email or password",
						},
						{ status: 401 }
					);
				}

				// Return admin profile (without passwordHash)
				const profile: AdminProfile = {
					id: admin.id,
					fullName: admin.fullName,
					email: admin.email,
					organizationName: admin.organizationName,
					danceStyle: admin.danceStyle,
					expectedCompetitors: admin.expectedCompetitors,
					verified: admin.verified,
					createdAt: admin.createdAt,
					trialExpiresAt: admin.trialExpiresAt,
				};

				return NextResponse.json({
					success: true,
					authenticated: true,
					admin: profile,
					message: "Authentication successful",
				});
			}
		}

		// Fallback to legacy single admin
		const credentials = await gcsHelpers.getAdminCredentials();

		if (credentials) {
			if (emailLower === credentials.email.toLowerCase()) {
				const isValid = await bcrypt.compare(
					password,
					credentials.passwordHash
				);

				if (isValid) {
					return NextResponse.json({
						success: true,
						authenticated: true,
						admin: {
							id: "legacy-admin",
							fullName: "Admin",
							email: credentials.email,
							organizationName: "Jack & Jill",
							danceStyle: "",
							expectedCompetitors: 0,
							verified: true,
							createdAt: "",
							trialExpiresAt: "",
						},
						message: "Authentication successful",
					});
				}
			}
		}

		return NextResponse.json(
			{ success: false, error: "Invalid email or password" },
			{ status: 401 }
		);
	} catch (error) {
		console.error("[API] Admin auth error:", error);
		return NextResponse.json(
			{ success: false, error: "Authentication failed" },
			{ status: 500 }
		);
	}
}
