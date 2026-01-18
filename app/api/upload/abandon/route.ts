import { NextRequest, NextResponse } from 'next/server'
import { abandonBatch } from '@/lib/batch-processor'

interface AbandonRequest {
  batchId: string
}

export async function POST(request: NextRequest) {
  try {
    const body: AbandonRequest = await request.json()

    if (!body.batchId) {
      return NextResponse.json(
        { error: 'batchId is required' },
        { status: 400 }
      )
    }

    abandonBatch(body.batchId)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Failed to abandon batch:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
