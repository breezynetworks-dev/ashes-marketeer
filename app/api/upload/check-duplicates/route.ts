import { NextRequest, NextResponse } from 'next/server'
import { db, uploadHistory } from '@/db'
import { eq, and, sql } from 'drizzle-orm'

interface FileToCheck {
  filename: string
  hash: string
  date: string
}

interface CheckDuplicatesRequest {
  files: FileToCheck[]
}

interface DuplicateResult {
  filename: string
  isDuplicate: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckDuplicatesRequest = await request.json()

    if (!body.files || !Array.isArray(body.files)) {
      return NextResponse.json(
        { error: 'Invalid request: files array is required' },
        { status: 400 }
      )
    }

    const results: DuplicateResult[] = []

    for (const file of body.files) {
      if (!file.filename || !file.hash || !file.date) {
        results.push({
          filename: file.filename || 'unknown',
          isDuplicate: false,
        })
        continue
      }

      // Query for existing file with same hash on same day (content-based deduplication)
      const existingRecords = await db
        .select()
        .from(uploadHistory)
        .where(
          and(
            eq(uploadHistory.fileHash, file.hash),
            sql`DATE(${uploadHistory.processedAt}) = ${file.date}`
          )
        )
        .limit(1)

      results.push({
        filename: file.filename,
        isDuplicate: existingRecords.length > 0,
      })
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Failed to check duplicates:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
