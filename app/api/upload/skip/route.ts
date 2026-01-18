import { NextRequest, NextResponse } from 'next/server'
import { skipFile } from '@/lib/batch-processor'

interface SkipRequest {
  batchId: string
}

export async function POST(request: NextRequest) {
  try {
    const body: SkipRequest = await request.json()

    if (!body.batchId) {
      return NextResponse.json(
        { error: 'batchId is required' },
        { status: 400 }
      )
    }

    skipFile(body.batchId)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Failed to skip file:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
