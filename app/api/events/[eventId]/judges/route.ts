// API: Judges Management
// GET /api/events/[eventId]/judges - List judges
// POST /api/events/[eventId]/judges - Add new judge

import { type NextRequest, NextResponse } from "next/server"
import type { Judge } from "@/lib/types"

function generateToken(): string {
  return `judge-${Math.random().toString(36).substring(2, 10)}`
}

function generatePin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

// GET: List all judges
export async function GET(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const { searchParams } = new URL(request.url)
  const includeTokens = searchParams.get("includeTokens") === "true" // Admin only

  try {
    return NextResponse.json({
      success: true,
      data: [],
      message: "Judges retrieved",
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to fetch judges" }, { status: 500 })
  }
}

// POST: Add new judge
export async function POST(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params

  try {
    const body = await request.json()
    const { name, gender, photoUrl, requirePin } = body

    if (!name || !gender) {
      return NextResponse.json({ success: false, error: "Missing required fields: name, gender" }, { status: 400 })
    }

    const judge: Judge = {
      id: `judge-${Date.now()}`,
      name,
      gender,
      photoUrl: photoUrl || `/placeholder.svg?height=200&width=200&query=judge`,
      token: generateToken(),
      pin: requirePin ? generatePin() : undefined,
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...judge,
          judgeUrl: `/judge/${judge.token}`,
        },
        message: "Judge added successfully",
      },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to add judge" }, { status: 500 })
  }
}
