// API: Get competitor photo URL (fresh signed URL)
// GET /api/competitors/photo?event={eventId}&number={competitorNumber}
// OR /api/competitors/photo?eventId={eventId}&competitorId={competitorId}
import { NextRequest, NextResponse } from "next/server";
import { gcsHelpers, gcsClient } from "@/lib/gcs-client";
import {
	GCS_PATHS,
	GCS_BUCKET_NAME,
	SIGNED_URL_EXPIRY,
} from "@/lib/gcs-config";

interface Competitor {
	id: string;
	number: number;
	photoUrl?: string;
}

export async function GET(request: NextRequest) {
	// Support both parameter formats for backward compatibility
	const eventId =
		request.nextUrl.searchParams.get("eventId") ||
		request.nextUrl.searchParams.get("event");
	const competitorId = request.nextUrl.searchParams.get("competitorId");
	const competitorNumber = request.nextUrl.searchParams.get("number");

	if (!eventId) {
		return NextResponse.json(
			{ error: "Event ID is required" },
			{ status: 400 },
		);
	}

	// Must have either competitorId or number
	if (!competitorId && !competitorNumber) {
		return NextResponse.json(
			{ error: "Competitor ID or number is required" },
			{ status: 400 },
		);
	}

	try {
		let targetCompetitorId = competitorId;

		// If we have competitorNumber but not competitorId, look up the competitor
		if (!targetCompetitorId && competitorNumber) {
			const competitors = (await gcsHelpers.getCompetitors(eventId)) as
				| Competitor[]
				| null;

			if (!competitors) {
				return NextResponse.json(
					{ error: "Event not found" },
					{ status: 404 },
				);
			}

			const competitor = competitors.find(
				(c) => c.number === parseInt(competitorNumber, 10),
			);

			if (!competitor) {
				return NextResponse.json(
					{ error: "Competitor not found" },
					{ status: 404 },
				);
			}

			targetCompetitorId = competitor.id;
		}

		// Generate a fresh signed URL
		let photoUrl = null;

		const jpgPath = GCS_PATHS.competitorPhoto(eventId, targetCompetitorId!);
		const pngPath = jpgPath.replace(".jpg", ".png");

		// Check which format exists and return a fresh signed URL
		if (await gcsClient.exists(jpgPath)) {
			photoUrl = await gcsClient.getSignedUrl(jpgPath, {
				action: "read",
				expiresIn: SIGNED_URL_EXPIRY.photo,
			});
		} else if (await gcsClient.exists(pngPath)) {
			photoUrl = await gcsClient.getSignedUrl(pngPath, {
				action: "read",
				expiresIn: SIGNED_URL_EXPIRY.photo,
			});
		}

		return NextResponse.json({
			success: true,
			photoUrl,
		});
	} catch (error) {
		console.error("[API] Get competitor photo error:", error);
		return NextResponse.json(
			{ error: "Failed to get competitor photo" },
			{ status: 500 },
		);
	}
}
