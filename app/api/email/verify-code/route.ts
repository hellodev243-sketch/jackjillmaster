// API endpoint to verify the code
import { NextRequest, NextResponse } from "next/server";
import { verifyCode } from "@/lib/email";

export async function POST(request: NextRequest) {
	try {
		const { email, code } = await request.json();

		if (!email || !code) {
			return NextResponse.json(
				{ success: false, error: "Email and code are required" },
				{ status: 400 }
			);
		}

		const result = verifyCode(email, code);

		if (!result.valid) {
			return NextResponse.json(
				{ success: false, error: result.error },
				{ status: 400 }
			);
		}

		return NextResponse.json({
			success: true,
			message: "Email verified successfully",
		});
	} catch (error) {
		console.error("[API] Verify code error:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to verify code" },
			{ status: 500 }
		);
	}
}
