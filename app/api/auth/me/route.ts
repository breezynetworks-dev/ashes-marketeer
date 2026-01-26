import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('session')?.value

  if (!token) {
    return NextResponse.json({ authenticated: false, role: null })
  }

  const role = verifySessionToken(token)

  if (!role) {
    return NextResponse.json({ authenticated: false, role: null })
  }

  return NextResponse.json({ authenticated: true, role })
}
