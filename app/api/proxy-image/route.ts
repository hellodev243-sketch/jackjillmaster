import { NextRequest, NextResponse } from "next/server";

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
	return new NextResponse(null, {
		status: 200,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		},
	});
}

/**
 * Proxy endpoint to fetch images and bypass CORS restrictions
 * This allows the client to fetch images from Google Cloud Storage
 */
export async function GET(request: NextRequest) {
	try {
		const searchParams = request.nextUrl.searchParams;
		const imageUrl = searchParams.get("url");

		if (!imageUrl) {
			console.error("Proxy image: Missing image URL");
			return NextResponse.json(
				{ error: "Missing image URL" },
				{ status: 400 }
			);
		}

		// Validate URL format
		try {
			new URL(imageUrl);
		} catch (urlError) {
			console.error("Proxy image: Invalid URL format:", imageUrl);
			return NextResponse.json(
				{ error: "Invalid URL format" },
				{ status: 400 }
			);
		}

		console.log("Proxy image: Fetching image from:", imageUrl);

		// Fetch the image from the URL with proper headers and timeout
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

		const response = await fetch(imageUrl, {
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
			},
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			console.error(
				`Proxy image: Failed to fetch image: ${response.status} ${response.statusText}`
			);
			console.error(
				"Response headers:",
				Object.fromEntries(response.headers.entries())
			);

			return NextResponse.json(
				{
					error: `Failed to fetch image: ${response.status} ${response.statusText}`,
				},
				{ status: response.status }
			);
		}

		// Get the image data
		const imageBuffer = await response.arrayBuffer();
		const contentType =
			response.headers.get("content-type") || "image/jpeg";

		console.log(
			`Proxy image: Successfully fetched image, size: ${imageBuffer.byteLength} bytes, type: ${contentType}`
		);

		// Return the image with proper headers
		return new NextResponse(imageBuffer, {
			status: 200,
			headers: {
				"Content-Type": contentType,
				"Cache-Control": "public, max-age=31536000, immutable",
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "GET",
				"Access-Control-Allow-Headers": "Content-Type",
			},
		});
	} catch (error) {
		console.error("Error proxying image:", error);

		// Handle timeout/abort errors specifically
		if (error instanceof Error && error.name === "AbortError") {
			return NextResponse.json(
				{ error: "Request timeout - image took too long to fetch" },
				{ status: 408 }
			);
		}

		return NextResponse.json(
			{ error: "Failed to proxy image" },
			{ status: 500 }
		);
	}
}
