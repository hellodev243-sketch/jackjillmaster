// API endpoint to send registration confirmation emails
import { NextRequest, NextResponse } from "next/server";
import {
	sendCompetitorConfirmationEmail,
	sendAdminNotificationEmail,
	clearVerification,
} from "@/lib/email";

export async function POST(request: NextRequest) {
	try {
		const {
			email,
			competitorName,
			competitorNumber,
			role,
			eventName,
			eventDate,
			eventVenue,
			eventId,
			gender,
			photoUrl,
		} = await request.json();

		if (!email || !competitorName || !competitorNumber) {
			return NextResponse.json(
				{ success: false, error: "Missing required fields" },
				{ status: 400 }
			);
		}

		// Send confirmation email to competitor
		const competitorResult = await sendCompetitorConfirmationEmail(
			email,
			competitorName,
			competitorNumber,
			role,
			eventName || "Jack & Jill Competition",
			eventDate || "",
			eventVenue || "TBA",
			eventId,
			gender,
			photoUrl
		);

		// Send notification email to admin
		const adminResult = await sendAdminNotificationEmail(
			competitorName,
			competitorNumber,
			email,
			role,
			eventName || "Jack & Jill Competition",
			eventDate || "",
			eventVenue || "TBA"
		);

		// Clear verification after sending emails
		clearVerification(email);

		// Return success even if one email fails (log the error)
		if (!competitorResult.success) {
			console.error(
				"[Email] Failed to send competitor confirmation:",
				competitorResult.error
			);
		}
		if (!adminResult.success) {
			console.error(
				"[Email] Failed to send admin notification:",
				adminResult.error
			);
		}

		return NextResponse.json({
			success: true,
			competitorEmailSent: competitorResult.success,
			adminEmailSent: adminResult.success,
		});
	} catch (error) {
		console.error("[API] Send confirmation error:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to send confirmation emails" },
			{ status: 500 }
		);
	}
}
