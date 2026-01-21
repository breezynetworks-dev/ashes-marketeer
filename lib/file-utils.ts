import { createHash } from 'crypto'

/**
 * Generates SHA-256 hash from file buffer for duplicate detection
 */
export function generateFileHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}
