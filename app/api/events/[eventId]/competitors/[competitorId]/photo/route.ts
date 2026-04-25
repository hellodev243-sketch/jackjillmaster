// API: Competitor Photo Upload
// POST /api/events/[eventId]/competitors/[competitorId]/photo - Get upload URL
// DELETE - Remove photo

import { type NextRequest, NextResponse } from "next/server";
import { gcsHelpers } from "@/lib/gcs-client";

type Params = Promise<{ eventId: string; competitorId: string }>;

// POST: Get signed upload URL for photo
export async function POST(
	request: NextRequest,
	{ params }: { params: Params }
) {
	const { eventId, competitorId } = await params;

	try {
		const { contentType = "image/jpeg" } = await request
			.json()
			.catch(() => ({}));
		const uploadUrl = await gcsHelpers.getPhotoUploadUrl(
			eventId,
			"competitor",
			competitorId,
			contentType
		);

		return NextResponse.json({
			success: true,
			data: {
				uploadUrl,
				expiresIn: 600, // 10 minutes
				instructions:
					"PUT your image file to this URL with Content-Type header",
			},
		});
	} catch (error) {
		return NextResponse.json(
			{ success: false, error: "Failed to generate upload URL" },
			{ status: 500 }
		);
	}
}
