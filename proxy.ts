import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySessionToken } from '@/lib/auth'

// Routes that don't require authentication
const publicRoutes = ['/login']

// API routes that don't require authentication
const publicApiRoutes = ['/api/auth/login']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (publicRoutes.includes(pathname)) {
    // If already logged in with valid session, redirect to home
    const session = request.cookies.get('session')
    if (session?.value && verifySessionToken(session.value)) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  // Allow public API routes
  if (publicApiRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Check for session cookie and verify it's valid
  const session = request.cookies.get('session')
  const isValidSession = session?.value && verifySessionToken(session.value)

  if (!isValidSession) {
    // Clear invalid session cookie
    const response = pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url))

    if (session?.value) {
      response.cookies.delete('session')
    }

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$).*)',
  ],
}
