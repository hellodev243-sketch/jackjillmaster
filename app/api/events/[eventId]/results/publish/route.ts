// API: Publish Results and Advance Round
// POST /api/events/[eventId]/results/publish

import { type NextRequest, NextResponse } from "next/server"
import type { RoundType } from "@/lib/types"

export async function POST(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params

  try {
    const { round, advanceCount } = await request.json()

    // In production:
    // 1. Calculate final rankings for current round
    // 2. Mark eliminated competitors
    // 3. Save results to GCS
    // 4. Update event to next round
    // 5. Update pairing history

    const nextRound: Record<RoundType, RoundType | null> = {
      round1: "round2",
      round2: "finals",
      finals: null,
    }

    return NextResponse.json({
      success: true,
      data: {
        currentRound: round,
        nextRound: nextRound[round as RoundType],
        advancedCount: advanceCount,
      },
      message: "Results published, advancing to next round",
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to publish results" }, { status: 500 })
  }
}
