import { NextRequest, NextResponse } from 'next/server'
import { db, settings } from '@/db'
import { eq } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params

    const [setting] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key))

    if (!setting) {
      return NextResponse.json(
        { error: 'Setting not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ value: setting.value })
  } catch (error) {
    console.error('Failed to fetch setting:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    const body = await request.json()

    if (!body || body.value === undefined) {
      return NextResponse.json(
        { error: 'Missing value in request body' },
        { status: 400 }
      )
    }

    // For trend_period_days, wrap the value in the expected JSONB structure
    let valueToStore = body.value
    if (key === 'trend_period_days' && typeof body.value === 'number') {
      valueToStore = { days: body.value }
    }

    // Check if setting exists
    const [existingSetting] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key))

    if (!existingSetting) {
      // Insert new setting
      const [newSetting] = await db
        .insert(settings)
        .values({ key, value: valueToStore })
        .returning()

      return NextResponse.json({ value: newSetting.value })
    } else {
      // Update existing setting
      const [updatedSetting] = await db
        .update(settings)
        .set({ value: valueToStore })
        .where(eq(settings.key, key))
        .returning()

      return NextResponse.json({ value: updatedSetting.value })
    }
  } catch (error) {
    console.error('Failed to update setting:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
