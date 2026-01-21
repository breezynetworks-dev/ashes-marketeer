import { NextRequest, NextResponse } from 'next/server'
import { createAdminSessionToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()

    const adminCode = process.env.ADMIN_CODE
    if (!adminCode) {
      return NextResponse.json(
        { error: 'Admin access not configured' },
        { status: 500 }
      )
    }

    if (code !== adminCode) {
      return NextResponse.json(
        { error: 'Invalid admin code' },
        { status: 401 }
      )
    }

    // Create signed admin session token
    const token = createAdminSessionToken()

    // Set httpOnly cookie
    const response = NextResponse.json({ success: true })
    response.cookies.set('admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return response
  } catch (error) {
    console.error('Admin login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
