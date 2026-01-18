import { NextResponse } from 'next/server'
import { db, uploadHistory } from '@/db'
import { eq, desc } from 'drizzle-orm'

export async function GET() {
  try {
    const recentUploads = await db
      .select({
        id: uploadHistory.id,
        fileName: uploadHistory.fileName,
        processedAt: uploadHistory.processedAt,
        itemCount: uploadHistory.itemCount,
        status: uploadHistory.status,
      })
      .from(uploadHistory)
      .where(eq(uploadHistory.status, 'success'))
      .orderBy(desc(uploadHistory.processedAt))
      .limit(5)

    return NextResponse.json(recentUploads)
  } catch (error) {
    console.error('Failed to fetch recent uploads:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
