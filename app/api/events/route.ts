// API: Events Management
// GET /api/events - List all events
// POST /api/events - Create new event

import { type NextRequest, NextResponse } from "next/server";
import { gcsHelpers } from "@/lib/gcs-client";
import type { Event, EventSummary } from "@/lib/types";

// GET: List all events
export async function GET() {
	try {
		const events = (await gcsHelpers.listEvents()) as Event[];
		const summaries: EventSummary[] = events.map((e) => ({
			id: e.id,
			name: e.name,
			date: e.date,
			venue: e.venue,
			status: e.status || "active",
			competitorCount: e.competitors?.length || 0,
			judgeCount: e.judges?.length || 0,
			createdAt: e.createdAt || new Date().toISOString(),
			adminId: e.adminId,
		}));

		return NextResponse.json({
			success: true,
			events: summaries,
		});
	} catch (error) {
		console.error("[API] Events list error:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to fetch events" },
			{ status: 500 }
		);
	}
}

// POST: Create new event
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const {
			name,
			date,
			venue,
			maleStartNumber,
			maleEndNumber,
			femaleStartNumber,
			femaleEndNumber,
		} = body;

		if (!name || !date || !venue) {
			return NextResponse.json(
				{
					success: false,
					error: "Missing required fields: name, date, venue",
				},
				{ status: 400 }
			);
		}

		// Validate numbers (must be >= 0 if provided)
		const maleStart =
			maleStartNumber !== undefined ? Number(maleStartNumber) : undefined;
		const maleEnd =
			maleEndNumber !== undefined ? Number(maleEndNumber) : undefined;
		const femaleStart =
			femaleStartNumber !== undefined
				? Number(femaleStartNumber)
				: undefined;
		const femaleEnd =
			femaleEndNumber !== undefined ? Number(femaleEndNumber) : undefined;

		if (
			(maleStart !== undefined && maleStart < 0) ||
			(maleEnd !== undefined && maleEnd < 0) ||
			(femaleStart !== undefined && femaleStart < 0) ||
			(femaleEnd !== undefined && femaleEnd < 0)
		) {
			return NextResponse.json(
				{
					success: false,
					error: "Numbers cannot be negative",
				},
				{ status: 400 }
			);
		}

		// Validate ending >= starting (only if both are provided)
		if (
			maleStart !== undefined &&
			maleEnd !== undefined &&
			maleEnd < maleStart
		) {
			return NextResponse.json(
				{
					success: false,
					error: "Male ending number must be >= starting number",
				},
				{ status: 400 }
			);
		}
		if (
			femaleStart !== undefined &&
			femaleEnd !== undefined &&
			femaleEnd < femaleStart
		) {
			return NextResponse.json(
				{
					success: false,
					error: "Female ending number must be >= starting number",
				},
				{ status: 400 }
			);
		}

		const now = new Date().toISOString();
		const eventId = `event-${Date.now()}`;
		const newEvent: Event = {
			id: eventId,
			name,
			date,
			venue,
			status: "active",
			currentRound: "round1",
			currentHeat: 1,
			currentRotation: 1,
			votingOpen: false,
			competitors: [],
			judges: [],
			heats: [],
			votes: [],
			pairingHistory: [],
			maleStartNumber: maleStart,
			maleEndNumber: maleEnd,
			femaleStartNumber: femaleStart,
			femaleEndNumber: femaleEnd,
			createdAt: now,
			updatedAt: now,
		};

		// Save to GCS
		await gcsHelpers.saveEventMetadata(eventId, newEvent);

		return NextResponse.json(
			{
				success: true,
				event: newEvent,
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error("[API] Event create error:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to create event" },
			{ status: 500 }
		);
	}
}
