import { NextRequest, NextResponse } from "next/server";
import { gcsHelpers } from "@/lib/gcs-client";
import type { Event } from "@/lib/types";

export async function POST(request: NextRequest) {
	try {
		const { token, pin } = await request.json();

		if (!token) {
			return NextResponse.json(
				{ success: false, error: "Token is required" },
				{ status: 400 }
			);
		}

		// Search all events for the judge token
		const events = (await gcsHelpers.listEvents()) as Event[];

		for (const event of events) {
			const judge = event.judges.find((j) => j.token === token);
			if (judge) {
				// Found the judge
				if (judge.pin && judge.pin !== pin) {
					return NextResponse.json(
						{
							success: false,
							error: "Invalid PIN",
							needsPin: true,
						},
						{ status: 401 }
					);
				}

				return NextResponse.json({
					success: true,
					authenticated: true,
					judge,
					eventId: event.id,
				});
			}
		}

		return NextResponse.json(
			{ success: false, error: "Invalid judge token" },
			{ status: 404 }
		);
	} catch (error) {
		console.error("[API] Judge auth error:", error);
		return NextResponse.json(
			{ success: false, error: "Authentication failed" },
			{ status: 500 }
		);
	}
}
