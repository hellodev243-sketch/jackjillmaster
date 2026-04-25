// API: Results
// GET /api/events/[eventId]/results - Get current rankings
// POST /api/events/[eventId]/results/publish - Publish results

import { type NextRequest, NextResponse } from "next/server"
import type { Gender } from "@/lib/types"

// GET: Get current rankings
export async function GET(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const { searchParams } = new URL(request.url)
  const round = searchParams.get("round")
  const gender = searchParams.get("gender") as Gender | null

  try {
    // In production:
    // const competitors = await gcsClient.downloadJson(...)
    // const votes = await gcsClient.downloadJson(...)
    // const maleRankings = calculateRankings(competitors, votes, 'male')
    // const femaleRankings = calculateRankings(competitors, votes, 'female')

    return NextResponse.json({
      success: true,
      data: {
        maleRankings: [],
        femaleRankings: [],
      },
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to fetch results" }, { status: 500 })
  }
}
