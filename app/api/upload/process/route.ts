import { NextRequest, NextResponse } from 'next/server'
import { createBatch, type FileToProcess, type NodeType } from '@/lib/batch-processor'

interface ProcessRequest {
  files: FileToProcess[]
  uploadedBy?: string
  node?: NodeType
}

export async function POST(request: NextRequest) {
  try {
    const body: ProcessRequest = await request.json()

    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: files array is required and must not be empty' },
        { status: 400 }
      )
    }

    // Validate file objects
    for (const file of body.files) {
      if (!file.filename || !file.hash) {
        return NextResponse.json(
          { error: 'Invalid file object: filename and hash are required' },
          { status: 400 }
        )
      }
    }

    // Create batch with uploader info
    const batchId = createBatch(body.files, body.uploadedBy, body.node)

    // Don't start processing here - SSE endpoint will start it
    // This allows SSE clients to receive all events from the beginning

    return NextResponse.json({ batchId }, { status: 200 })
  } catch (error) {
    console.error('Failed to initiate batch processing:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
