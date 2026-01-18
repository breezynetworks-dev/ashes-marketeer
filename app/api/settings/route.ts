import { NextRequest, NextResponse } from 'next/server'
import { db, settings } from '@/db'

export async function GET() {
  try {
    const allSettings = await db.select().from(settings)

    // Convert to key-value object
    const settingsObject = allSettings.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, any>)

    return NextResponse.json(settingsObject)
  } catch (error) {
    console.error('Failed to fetch settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
