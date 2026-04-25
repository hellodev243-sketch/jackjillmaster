// API: Round Management
// GET /api/events/[eventId]/rounds/[round] - Get round data
// POST /api/events/[eventId]/rounds/[round]/generate - Generate pairings
// PUT /api/events/[eventId]/rounds/[round] - Update round status

import { type NextRequest, NextResponse } from "next/server";
import type { RoundType } from "@/lib/types";

type Params = Promise<{ eventId: string; round: string }>;

// GET: Get round data (heats, votes, results)
export async function GET(
	request: NextRequest,
	{ params }: { params: Params }
) {
	const { eventId, round } = await params;
	const roundType = round as RoundType;

	try {
		// Fetch all round data
		return NextResponse.json({
			success: true,
			data: {
				round: roundType,
				heats: [],
				votes: [],
				results: [],
			},
		});
	} catch (error) {
		return NextResponse.json(
			{ success: false, error: "Failed to fetch round data" },
			{ status: 500 }
		);
	}
}

// PUT: Update round (advance heat, toggle voting)
export async function PUT(
	request: NextRequest,
	{ params }: { params: Params }
) {
	const { eventId, round } = await params;

	try {
		const { action, heatNumber } = await request.json();

		switch (action) {
			case "open_voting":
				// Set voting to open for current heat
				break;
			case "close_voting":
				// Close voting, calculate results
				break;
			case "advance_heat":
				// Move to next heat
				break;
			case "finalize":
				// Calculate final results, advance competitors
				break;
		}

		return NextResponse.json({
			success: true,
			message: `Action '${action}' completed`,
		});
	} catch (error) {
		return NextResponse.json(
			{ success: false, error: "Failed to update round" },
			{ status: 500 }
		);
	}
}
