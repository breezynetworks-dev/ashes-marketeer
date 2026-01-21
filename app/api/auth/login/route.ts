import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSessionToken, createAdminSessionToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()
    const accessCode = process.env.ACCESS_CODE
    const adminCode = process.env.ADMIN_CODE

    if (!accessCode) {
      console.error('ACCESS_CODE environment variable not set')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const isAdmin = adminCode && code === adminCode
    const isUser = code === accessCode

    if (!isAdmin && !isUser) {
      return NextResponse.json(
        { error: 'Invalid access code' },
        { status: 401 }
      )
    }

    // Create a cryptographically signed session token
    const sessionToken = createSessionToken()

    // Set session cookie (30 days)
    const cookieStore = await cookies()
    cookieStore.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })

    // If admin, also set admin session cookie
    if (isAdmin) {
      const adminSessionToken = createAdminSessionToken()
      cookieStore.set('admin_session', adminSessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  }
}
