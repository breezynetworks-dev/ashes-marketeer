import { createHash } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'

/**
 * Generates SHA-256 hash from file buffer
 */
export function generateFileHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * Gets the upload directory path for today in MM-DD-YYYY format
 */
export function getTodayUploadDirectory(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const year = now.getFullYear()

  return join(process.cwd(), 'uploads', `${month}-${day}-${year}`)
}

/**
 * Ensures directory exists, creates if it doesn't
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true })
}

/**
 * Saves file buffer to specified path
 */
export async function saveFile(filePath: string, buffer: Buffer): Promise<void> {
  await writeFile(filePath, buffer)
}
