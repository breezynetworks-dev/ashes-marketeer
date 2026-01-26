import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySessionToken, canAccessRoute, getDefaultRouteForRole } from '@/lib/auth'

// Routes that don't require authentication
const publicRoutes = ['/login']

// API routes that don't require authentication
const publicApiRoutes = ['/api/auth/login', '/api/auth/me', '/api/auth/logout']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (publicRoutes.includes(pathname)) {
    // If already logged in with valid session, redirect to appropriate page
    const session = request.cookies.get('session')
    if (session?.value) {
      const role = verifySessionToken(session.value)
      if (role) {
        return NextResponse.redirect(new URL(getDefaultRouteForRole(role), request.url))
      }
    }
    return NextResponse.next()
  }

  // Allow public API routes
  if (publicApiRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Check for session cookie and verify it's valid
  const session = request.cookies.get('session')
  const role = session?.value ? verifySessionToken(session.value) : null

  if (!role) {
    // No valid session - clear invalid cookie and redirect/return 401
    const response = pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url))

    if (session?.value) {
      response.cookies.delete('session')
    }

    return response
  }

  // Check if role has access to this route
  if (!canAccessRoute(role, pathname)) {
    // User is authenticated but doesn't have access to this route
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    // Redirect to their default page
    return NextResponse.redirect(new URL(getDefaultRouteForRole(role), request.url))
  }

  // Add role to request headers for use in API routes/pages
  const response = NextResponse.next()
  response.headers.set('x-user-role', role)
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$|.*\\.svg$).*)',
  ],
}
