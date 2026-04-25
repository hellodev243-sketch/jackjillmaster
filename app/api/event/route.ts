// Fallback API Route for Event Data
// Used when Socket.IO is not available

import { NextRequest, NextResponse } from "next/server";
import { gcsHelpers } from "@/lib/gcs-client";
import type { Event } from "@/lib/types";

const DEFAULT_EVENT_ID = "demo-event-1";

// Filter event data for public/judge clients
// Hide vote counts and detailed vote data until the round is complete
function filterEventForPublic(event: Event): Event {
	// Check if all heats in each round have completed voting
	const round1Heats = event.heats.filter((h) => h.round === "round1");
	const round1Complete =
		round1Heats.length > 0 &&
		round1Heats.every((h) => h.votingStatus === "submitted");

	const round2Heats = event.heats.filter((h) => h.round === "round2");
	const round2Complete =
		round2Heats.length > 0 &&
		round2Heats.every((h) => h.votingStatus === "submitted");

	const finalsHeats = event.heats.filter((h) => h.round === "finals");
	const finalsComplete =
		finalsHeats.length > 0 &&
		finalsHeats.every((h) => h.votingStatus === "submitted");

	// For public display, show completed round results but hide active round vote counts
	return {
		...event,
		competitors: event.competitors.map((c) => ({
			...c,
			// Always show round1Votes if Round 1 is complete (for historical results)
			round1Votes: round1Complete ? c.round1Votes : undefined,
			// Always show round2Votes if Round 2 is complete (for historical results)
			round2Votes: round2Complete ? c.round2Votes : undefined,
			// Always show finalsPoints if finals are complete
			finalsPoints: finalsComplete ? c.finalsPoints : undefined,
			// Show current voteCount only if current round is complete
			voteCount:
				(event.currentRound === "round1" && round1Complete) ||
				(event.currentRound === "round2" && round2Complete) ||
				(event.currentRound === "finals" && finalsComplete)
					? c.voteCount
					: 0,
		})),
	};
}

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const eventId = searchParams.get("eventId") || DEFAULT_EVENT_ID;
		const isAdmin = searchParams.get("admin") === "true";

		const event = (await gcsHelpers.getEventMetadata(
			eventId
		)) as Event | null;

		if (!event) {
			return NextResponse.json(
				{ success: false, error: "Event not found" },
				{ status: 404 }
			);
		}

		// Filter event data for non-admin clients
		const responseEvent = isAdmin ? event : filterEventForPublic(event);

		return NextResponse.json({ success: true, event: responseEvent });
	} catch (error) {
		console.error("[API] Event get error:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to load event" },
			{ status: 500 }
		);
	}
}
