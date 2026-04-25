// REST API for competitor registration (fallback when Socket.IO unavailable)
import { NextRequest, NextResponse } from "next/server";
import { gcsClient, gcsHelpers } from "@/lib/gcs-client";
import { GCS_PATHS } from "@/lib/gcs-config";
import type { Event, Competitor, Gender } from "@/lib/types";

const DEFAULT_EVENT_ID = "demo-event-1";

export async function POST(request: NextRequest) {
	try {
		const { eventId, name, gender, photoData, photoType, number } =
			await request.json();
		const targetEventId = eventId || DEFAULT_EVENT_ID;

		if (!name || !gender) {
			return NextResponse.json(
				{ success: false, error: "Name and gender are required" },
				{ status: 400 }
			);
		}

		// Load event from GCS
		const event = (await gcsHelpers.getEventMetadata(
			targetEventId
		)) as Event | null;
		if (!event) {
			return NextResponse.json(
				{ success: false, error: "Event not found" },
				{ status: 404 }
			);
		}

		// Check if competition has started
		if (event.heats && event.heats.length > 0) {
			return NextResponse.json(
				{
					success: false,
					error: "Cannot add competitors after competition has started",
				},
				{ status: 400 }
			);
		}

		// Get gender-specific settings
		const genderCompetitors = event.competitors.filter(
			(c) => c.gender === gender
		);
		const rawBaseNumber =
			gender === "male" ? event.maleStartNumber : event.femaleStartNumber;
		const baseNumber =
			typeof rawBaseNumber === "number" ? rawBaseNumber : 0;
		const endNumber =
			gender === "male" ? event.maleEndNumber : event.femaleEndNumber;

		// Calculate max allowed competitors based on number range
		const maxCompetitors =
			typeof endNumber === "number"
				? endNumber - baseNumber + 1
				: undefined;

		// Check if we've reached the limit BEFORE assigning number
		if (
			maxCompetitors !== undefined &&
			genderCompetitors.length >= maxCompetitors
		) {
			const genderLabel =
				gender === "male" ? "Lead (Male)" : "Follow (Female)";
			return NextResponse.json(
				{
					success: false,
					error: `Registration limit reached! Maximum ${maxCompetitors} ${genderLabel} competitors allowed (numbers ${baseNumber} to ${endNumber}). Please contact the event organizer.`,
				},
				{ status: 400 }
			);
		}

		// Determine competitor number - use custom number if provided, otherwise auto-generate
		let competitorNumber: number;

		if (number !== undefined) {
			// Check if number is already taken
			const existingWithNumber = event.competitors.find(
				(c) => c.number === number
			);
			if (existingWithNumber) {
				return NextResponse.json(
					{
						success: false,
						error: `Competitor number ${number} is already taken`,
					},
					{ status: 400 }
				);
			}
			// Validate custom number is within range
			if (
				typeof endNumber === "number" &&
				(number < baseNumber || number > endNumber)
			) {
				return NextResponse.json(
					{
						success: false,
						error: `Competitor number must be between ${baseNumber} and ${endNumber}`,
					},
					{ status: 400 }
				);
			}
			competitorNumber = number;
			// Remove from deleted pool if it was there
			const deletedPool =
				gender === "male"
					? event.deletedMaleNumbers
					: event.deletedFemaleNumbers;
			if (deletedPool) {
				const poolIndex = deletedPool.indexOf(number);
				if (poolIndex !== -1) {
					deletedPool.splice(poolIndex, 1);
				}
			}
		} else {
			// Auto-generate number - check for reusable deleted numbers first
			const deletedPool =
				gender === "male"
					? event.deletedMaleNumbers
					: event.deletedFemaleNumbers;

			if (deletedPool && deletedPool.length > 0) {
				// Sort and use the smallest available deleted number
				deletedPool.sort((a, b) => a - b);
				competitorNumber = deletedPool.shift()!;
				// Update the pool in the event
				if (gender === "male") {
					event.deletedMaleNumbers = deletedPool;
				} else {
					event.deletedFemaleNumbers = deletedPool;
				}
			} else {
				// No deleted numbers available, generate new one
				const existingNumbers = genderCompetitors.map((c) => c.number);
				if (existingNumbers.length === 0) {
					competitorNumber = baseNumber;
				} else {
					const maxExisting = Math.max(...existingNumbers);
					competitorNumber = maxExisting + 1;
				}
			}
		}

		// Final check: ensure number doesn't exceed end limit
		if (typeof endNumber === "number" && competitorNumber > endNumber) {
			const genderLabel =
				gender === "male" ? "Lead (Male)" : "Follow (Female)";
			return NextResponse.json(
				{
					success: false,
					error: `Registration limit reached! Maximum ${genderLabel} competitor limit reached (numbers ${baseNumber} to ${endNumber}). Please contact the event organizer.`,
				},
				{ status: 400 }
			);
		}

		const competitorId = `${gender}-${Date.now()}`;

		let photoUrl = `/placeholder.svg?height=200&width=200&query=professional ${gender} latin dancer portrait`;

		// Upload photo if provided
		if (photoData && photoType) {
			try {
				const buffer = Buffer.from(photoData, "base64");
				const ext = photoType.includes("png") ? "png" : "jpg";
				const photoPath = GCS_PATHS.competitorPhoto(
					targetEventId,
					competitorId
				).replace(".jpg", `.${ext}`);
				await gcsClient.uploadFile(photoPath, buffer, {
					contentType: photoType,
				});
				photoUrl = await gcsClient.getSignedUrl(photoPath, {
					action: "read",
					expiresIn: 86400,
				});
			} catch (photoError) {
				console.error("[API] Photo upload error:", photoError);
				// Continue without photo
			}
		}

		const newCompetitor: Competitor = {
			id: competitorId,
			number: competitorNumber,
			name: name.trim(),
			gender: gender as Gender,
			photoUrl,
			voteCount: 0,
			eliminated: false,
		};

		// Save to GCS
		event.competitors.push(newCompetitor);
		event.updatedAt = new Date().toISOString();
		await gcsHelpers.saveEventMetadata(targetEventId, event);

		return NextResponse.json({
			success: true,
			competitor: newCompetitor,
		});
	} catch (error) {
		console.error("[API] Competitor registration error:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to register competitor" },
			{ status: 500 }
		);
	}
}
