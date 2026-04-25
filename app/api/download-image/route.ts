import { NextRequest, NextResponse } from "next/server";
import { gcsClient } from "@/lib/gcs-client";

/**
 * Download image directly from GCS using the SDK (bypasses CORS)
 * GET /api/download-image?path=events/event-123/competitors/photos/male-123.jpg
 */
export async function GET(request: NextRequest) {
	try {
		const searchParams = request.nextUrl.searchParams;
		const filePath = searchParams.get("path");

		if (!filePath) {
			return NextResponse.json(
				{ error: "Missing file path" },
				{ status: 400 }
			);
		}

		// Security: Only allow paths within events folder
		if (!filePath.startsWith("events/")) {
			return NextResponse.json(
				{ error: "Invalid file path" },
				{ status: 403 }
			);
		}

		// Download file from GCS
		const buffer = await gcsClient.downloadFile(filePath);

		if (!buffer) {
			return NextResponse.json(
				{ error: "File not found" },
				{ status: 404 }
			);
		}

		// Determine content type from extension
		const ext = filePath.split(".").pop()?.toLowerCase();
		const contentType =
			ext === "png"
				? "image/png"
				: ext === "webp"
				? "image/webp"
				: "image/jpeg";

		return new NextResponse(buffer as unknown as BodyInit, {
			status: 200,
			headers: {
				"Content-Type": contentType,
				"Cache-Control": "public, max-age=3600",
			},
		});
	} catch (error) {
		console.error("Error downloading image:", error);
		return NextResponse.json(
			{ error: "Failed to download image" },
			{ status: 500 }
		);
	}
}
