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

    // DEBUG: Log env var availability (remove after debugging)
    console.log('[AUTH DEBUG] Input code length:', code.length)
    console.log('[AUTH DEBUG] ADMIN_CODE set:', !!process.env.ADMIN_CODE, 'length:', process.env.ADMIN_CODE?.length)
    console.log('[AUTH DEBUG] BROWSER_CODE set:', !!process.env.BROWSER_CODE, 'length:', process.env.BROWSER_CODE?.length)
    console.log('[AUTH DEBUG] UPLOADER_CODE set:', !!process.env.UPLOADER_CODE, 'length:', process.env.UPLOADER_CODE?.length)

    const role = authenticateCode(code)

    console.log('[AUTH DEBUG] Resolved role:', role)

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
