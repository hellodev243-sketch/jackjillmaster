// API: Single Judge Operations

import { type NextRequest, NextResponse } from "next/server"

type Params = Promise<{ eventId: string; judgeId: string }>

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const { eventId, judgeId } = await params

  return NextResponse.json({ success: true, data: null })
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  const { eventId, judgeId } = await params
  const updates = await request.json()

  return NextResponse.json({ success: true, data: updates })
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const { eventId, judgeId } = await params

  return NextResponse.json({ success: true, message: "Judge removed" })
}
