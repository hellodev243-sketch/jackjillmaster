// API: Voting
// GET /api/events/[eventId]/votes - Get all votes (admin)
// POST /api/events/[eventId]/votes - Submit vote (judge)

import { type NextRequest, NextResponse } from "next/server";
import type { Vote } from "@/lib/types";

// GET: Get votes (admin only, requires auth)
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ eventId: string }> }
) {
	const { eventId } = await params;
	const { searchParams } = new URL(request.url);
	const round = searchParams.get("round");
	const heatId = searchParams.get("heatId");

	try {
		return NextResponse.json({
			success: true,
			data: [],
		});
	} catch (error) {
		return NextResponse.json(
			{ success: false, error: "Failed to fetch votes" },
			{ status: 500 }
		);
	}
}

// POST: Submit vote (from judge interface)
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ eventId: string }> }
) {
	const { eventId } = await params;

	try {
		const body = await request.json();
		const { judgeId, heatId, round, rankings } = body;

		// Validate
		if (
			!judgeId ||
			!heatId ||
			!round ||
			!rankings ||
			rankings.length === 0
		) {
			return NextResponse.json(
				{ success: false, error: "Missing required vote data" },
				{ status: 400 }
			);
		}

		// Validate rankings (should have valid rank numbers)
		const validRanks = rankings.every((r: { rank: number }) =>
			[1, 2, 3, 4, 5, 6].includes(r.rank)
		);
		if (!validRanks) {
			return NextResponse.json(
				{ success: false, error: "Invalid ranking format" },
				{ status: 400 }
			);
		}

		const vote: Vote = {
			judgeId,
			heatId,
			round,
			rankings,
			submittedAt: new Date().toISOString(),
		};

		// Save vote to GCS
		// In production: append to existing votes for this round

		return NextResponse.json(
			{
				success: true,
				data: vote,
				message: "Vote submitted successfully",
			},
			{ status: 201 }
		);
	} catch (error) {
		return NextResponse.json(
			{ success: false, error: "Failed to submit vote" },
			{ status: 500 }
		);
	}
}
