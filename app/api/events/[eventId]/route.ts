// API: Single Event Operations
// GET /api/events/[eventId] - Get event details
// PUT /api/events/[eventId] - Update event
// DELETE /api/events/[eventId] - Delete event

import { type NextRequest, NextResponse } from "next/server";
import { gcsHelpers, gcsClient } from "@/lib/gcs-client";

// GET: Get single event
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ eventId: string }> }
) {
	const { eventId } = await params;

	try {
		// In production: fetch from GCS
		// const event = await gcsClient.downloadJson(GCS_PATHS.eventMetadata(eventId))

		return NextResponse.json({
			success: true,
			data: null,
			message: "Event retrieved",
		});
	} catch (error) {
		return NextResponse.json(
			{ success: false, error: "Event not found" },
			{ status: 404 }
		);
	}
}

// PUT: Update event
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ eventId: string }> }
) {
	const { eventId } = await params;

	try {
		const updates = await request.json();

		// Fetch existing, merge updates, save
		await gcsHelpers.saveEventMetadata(eventId, updates);

		return NextResponse.json({
			success: true,
			data: updates,
			message: "Event updated",
		});
	} catch (error) {
		return NextResponse.json(
			{ success: false, error: "Failed to update event" },
			{ status: 500 }
		);
	}
}

// DELETE: Delete event (or archive)
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ eventId: string }> }
) {
	const { eventId } = await params;

	try {
		await gcsHelpers.deleteEventData(eventId);

		return NextResponse.json({
			success: true,
			message: "Event deleted",
		});
	} catch (error) {
		return NextResponse.json(
			{ success: false, error: "Failed to delete event" },
			{ status: 500 }
		);
	}
}
