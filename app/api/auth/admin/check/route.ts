import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSessionToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value

  if (!token) {
    return NextResponse.json({ authenticated: false })
  }

  const isValid = verifyAdminSessionToken(token)
  return NextResponse.json({ authenticated: isValid })
}
