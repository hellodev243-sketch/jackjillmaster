// API: Direct Upload Handler (alternative to signed URLs)
// POST /api/upload - Upload file directly

import { type NextRequest, NextResponse } from "next/server"
import { gcsClient } from "@/lib/gcs-client"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const path = formData.get("path") as string | null
    const type = formData.get("type") as string | null // 'competitor' | 'judge'
    const eventId = formData.get("eventId") as string | null
    const entityId = formData.get("entityId") as string | null

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "Invalid file type. Allowed: JPEG, PNG, WebP" },
        { status: 400 },
      )
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "File too large. Max 5MB" }, { status: 400 })
    }

    // Build path
    let uploadPath = path
    if (!uploadPath && eventId && entityId && type) {
      uploadPath = `events/${eventId}/${type}s/photos/${entityId}.jpg`
    }

    if (!uploadPath) {
      return NextResponse.json({ success: false, error: "Upload path required" }, { status: 400 })
    }

    // Convert to buffer and upload
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const url = await gcsClient.uploadFile(uploadPath, buffer, {
      contentType: file.type,
    })

    return NextResponse.json({
      success: true,
      data: {
        url,
        path: uploadPath,
      },
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 })
  }
}
