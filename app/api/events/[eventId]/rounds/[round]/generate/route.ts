// API: Generate Pairings for a Round
// POST /api/events/[eventId]/rounds/[round]/generate

import { type NextRequest, NextResponse } from "next/server";
import type { RoundType } from "@/lib/types";

type Params = Promise<{ eventId: string; round: string }>;

export async function POST(
	request: NextRequest,
	{ params }: { params: Params }
) {
	const { eventId, round } = await params;
	const roundType = round as RoundType;

	try {
		// In production:
		// 1. Fetch competitors (filtered by elimination status for round2/finals)
		// 2. Fetch pairing history
		// 3. Generate pairings
		// 4. Split into heats
		// 5. Save to GCS

		return NextResponse.json({
			success: true,
			data: {
				heatsGenerated: 0,
				couplesCreated: 0,
			},
			message: "Pairings generated successfully",
		});
	} catch (error) {
		return NextResponse.json(
			{ success: false, error: "Failed to generate pairings" },
			{ status: 500 }
		);
	}
}
