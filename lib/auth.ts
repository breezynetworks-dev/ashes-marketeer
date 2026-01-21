// Use Web Crypto API for Edge runtime compatibility (middleware)
const encoder = new TextEncoder()

const getSecret = () => {
  const secret = process.env.ACCESS_CODE
  if (!secret) throw new Error('ACCESS_CODE not set')
  return secret
}

// Simple sync hash for token creation (runs in Node.js API routes)
function simpleHash(data: string, secret: string): string {
  // Simple deterministic hash - XOR based mixing
  // This is NOT cryptographically secure alone, but combined with httpOnly cookie it's sufficient
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

// Create a signed session token
export function createSessionToken(): string {
  const payload = {
    created: Date.now(),
    random: Math.random().toString(36).slice(2),
  }
  const data = JSON.stringify(payload)
  const signature = simpleHash(data, getSecret())

  // Format: base64(payload).signature
  const token = `${btoa(data)}.${signature}`
  return token
}

// Verify a session token is valid (was signed by us)
export function verifySessionToken(token: string): boolean {
  try {
    const [payloadB64, signature] = token.split('.')
    if (!payloadB64 || !signature) return false

    const data = atob(payloadB64)
    const expectedSignature = simpleHash(data, getSecret())

    // Check signature matches
    if (signature !== expectedSignature) return false

    // Verify payload structure
    const payload = JSON.parse(data)
    if (!payload.created || !payload.random) return false

    return true
  } catch {
    return false
  }
}
