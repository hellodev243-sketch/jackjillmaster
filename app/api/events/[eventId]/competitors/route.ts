// API: Competitors Management
// GET /api/events/[eventId]/competitors - List competitors
// POST /api/events/[eventId]/competitors - Register new competitor

import { type NextRequest, NextResponse } from "next/server";
import type { Competitor, Gender } from "@/lib/types";

// GET: List all competitors for an event
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ eventId: string }> }
) {
	const { eventId } = await params;
	const { searchParams } = new URL(request.url);
	const gender = searchParams.get("gender") as Gender | null;

	try {
		// In production: fetch from GCS
		// let competitors = await gcsClient.downloadJson(GCS_PATHS.competitorsIndex(eventId))
		// if (gender) competitors = competitors.filter(c => c.gender === gender)

		return NextResponse.json({
			success: true,
			data: [],
			message: "Competitors retrieved",
		});
	} catch (error) {
		return NextResponse.json(
			{ success: false, error: "Failed to fetch competitors" },
			{ status: 500 }
		);
	}
}

// POST: Register new competitor
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ eventId: string }> }
) {
	const { eventId } = await params;

	try {
		const body = await request.json();
		const { name, gender, photoUrl } = body;

		if (!name || !gender) {
			return NextResponse.json(
				{
					success: false,
					error: "Missing required fields: name, gender",
				},
				{ status: 400 }
			);
		}

		// Calculate next number
		// In production: fetch existing competitors, calculate next number
		const baseNumber = gender === "male" ? 100 : 200;
		const nextNumber = baseNumber + 1; // Would calculate based on existing

		const competitor: Competitor = {
			id: `${gender}-${Date.now()}`,
			number: nextNumber,
			name,
			gender,
			photoUrl:
				photoUrl ||
				`/placeholder.svg?height=200&width=200&query=dancer`,
			voteCount: 0,
			eliminated: false,
		};

		// Save to GCS (would append to existing list)
		// await gcsHelpers.saveCompetitors(eventId, [...existing, competitor])

		return NextResponse.json(
			{
				success: true,
				data: competitor,
				message: `Registered successfully! Your number is ${nextNumber}`,
			},
			{ status: 201 }
		);
	} catch (error) {
		return NextResponse.json(
			{ success: false, error: "Failed to register competitor" },
			{ status: 500 }
		);
	}
}
