// Role-based authentication for three-tier access system
// Roles: uploader (upload only), browser (market only), admin (full access)

export type UserRole = 'uploader' | 'browser' | 'admin'

const getSecret = (role: UserRole): string => {
  const envKey = {
    uploader: 'UPLOADER_CODE',
    browser: 'BROWSER_CODE',
    admin: 'ADMIN_CODE',
  }[role]

  const secret = process.env[envKey]
  if (!secret) throw new Error(`${envKey} not set`)
  return secret
}

// Simple sync hash for token creation (runs in Node.js API routes)
function simpleHash(data: string, secret: string): string {
  // Simple deterministic hash - XOR based mixing
  // Combined with httpOnly cookie it's sufficient for this use case
  let hash = 0
  const combined = data + secret
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  // Add more entropy
  for (let i = combined.length - 1; i >= 0; i--) {
    const char = combined.charCodeAt(i)
    hash = ((hash << 3) + hash + char) | 0
  }
  return Math.abs(hash).toString(36) + secret.length.toString(36) + data.length.toString(36)
}

// Create a signed session token for a specific role
export function createSessionToken(role: UserRole): string {
  const payload = {
    role,
    created: Date.now(),
    random: Math.random().toString(36).slice(2),
  }
  const data = JSON.stringify(payload)
  const signature = simpleHash(data, getSecret(role))

  // Format: base64(payload).signature
  const token = `${btoa(data)}.${signature}`
  return token
}

// Verify a session token and return the role if valid
export function verifySessionToken(token: string): UserRole | null {
  try {
    const [payloadB64, signature] = token.split('.')
    if (!payloadB64 || !signature) return null

    const data = atob(payloadB64)
    const payload = JSON.parse(data)

    // Verify payload structure
    if (!payload.role || !payload.created || !payload.random) return null

    // Verify it's a valid role
    const role = payload.role as UserRole
    if (!['uploader', 'browser', 'admin'].includes(role)) return null

    // Verify signature matches for this role
    const expectedSignature = simpleHash(data, getSecret(role))
    if (signature !== expectedSignature) return null

    return role
  } catch {
    return null
  }
}

// Check if a code matches any role and return that role
export function authenticateCode(code: string): UserRole | null {
  // Check in order of most restrictive to least
  // This ensures if someone has the admin code, they get admin role
  try {
    if (process.env.ADMIN_CODE && code === process.env.ADMIN_CODE) {
      return 'admin'
    }
    if (process.env.BROWSER_CODE && code === process.env.BROWSER_CODE) {
      return 'browser'
    }
    if (process.env.UPLOADER_CODE && code === process.env.UPLOADER_CODE) {
      return 'uploader'
    }
  } catch {
    // Environment variable not set
  }
  return null
}

// Route access configuration
const routeAccess: Record<string, UserRole[]> = {
  '/upload': ['uploader', 'admin'],
  '/': ['browser', 'admin'],
  '/market': ['browser', 'admin'],
  '/statistics': ['admin'],
  '/changelog': ['admin'],
  '/settings': ['admin'],
}

// Check if a role can access a specific path
export function canAccessRoute(role: UserRole, pathname: string): boolean {
  // Check exact match first
  if (routeAccess[pathname]) {
    return routeAccess[pathname].includes(role)
  }

  // Check if path starts with any protected route
  for (const [route, roles] of Object.entries(routeAccess)) {
    if (pathname.startsWith(route + '/')) {
      return roles.includes(role)
    }
  }

  // API routes follow similar logic
  if (pathname.startsWith('/api/upload')) {
    return ['uploader', 'admin'].includes(role)
  }
  if (pathname.startsWith('/api/market') || pathname.startsWith('/api/items') || pathname.startsWith('/api/listings') || pathname.startsWith('/api/trends')) {
    return ['browser', 'admin'].includes(role)
  }
  if (pathname.startsWith('/api/settings')) {
    // Browser can read settings (GET), but only admin can modify (handled in route)
    return ['browser', 'admin'].includes(role)
  }
  if (pathname.startsWith('/api/statistics')) {
    return role === 'admin'
  }

  // Default: require admin for unknown routes
  return role === 'admin'
}

// Get the appropriate redirect path for a role when they try to access unauthorized content
export function getDefaultRouteForRole(role: UserRole): string {
  switch (role) {
    case 'uploader':
      return '/upload'
    case 'browser':
      return '/'
    case 'admin':
      return '/'
  }
}
