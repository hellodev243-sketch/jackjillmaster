// Health Check Endpoint for Railway and other deployment platforms

import { NextResponse } from "next/server";

export async function GET() {
	try {
		// Basic health check - server is running and responding
		return NextResponse.json({
			status: "healthy",
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			service: "jack-jill-competition",
			version: process.env.npm_package_version || "1.0.0",
		});
	} catch (error) {
		// If there's any error, return unhealthy status
		return NextResponse.json(
			{
				status: "unhealthy",
				timestamp: new Date().toISOString(),
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 503 }
		);
	}
}
