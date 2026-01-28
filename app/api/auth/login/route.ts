import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authenticateCode, createSessionToken, getDefaultRouteForRole } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()

    if (!code) {
      return NextResponse.json(
        { error: 'Access code required' },
        { status: 400 }
      )
    }

    const role = authenticateCode(code)

    if (!role) {
      return NextResponse.json(
        { error: 'Invalid access code' },
        { status: 401 }
      )
    }

    // Create a cryptographically signed session token with the role
    const sessionToken = createSessionToken(role)

    // Set session cookie (30 days)
    const cookieStore = await cookies()
    cookieStore.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })

    return NextResponse.json({
      success: true,
      role,
      redirect: getDefaultRouteForRole(role),
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  }
}
