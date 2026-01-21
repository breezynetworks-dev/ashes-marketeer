// In-memory store for uploaded images
// Images are stored temporarily between upload and processing
// Auto-expires after TTL to prevent memory leaks from abandoned uploads

const IMAGE_TTL_MS = 60 * 60 * 1000 // 60 minutes

interface StoredImage {
  buffer: Buffer
  expiresAt: number
}

const globalForImages = globalThis as unknown as {
  imageStore: Map<string, StoredImage>
  cleanupInterval: ReturnType<typeof setInterval> | null
}

if (!globalForImages.imageStore) {
  globalForImages.imageStore = new Map<string, StoredImage>()
}

if (!globalForImages.cleanupInterval) {
  // Run cleanup every 2 minutes
  globalForImages.cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [hash, stored] of globalForImages.imageStore) {
      if (now > stored.expiresAt) {
        globalForImages.imageStore.delete(hash)
      }
    }
  }, 2 * 60 * 1000)
}

const imageStore = globalForImages.imageStore

export function storeImage(hash: string, buffer: Buffer): void {
  imageStore.set(hash, {
    buffer,
    expiresAt: Date.now() + IMAGE_TTL_MS,
  })
}

export function getImage(hash: string): Buffer | undefined {
  const stored = imageStore.get(hash)
  if (!stored) return undefined

  // Check if expired
  if (Date.now() > stored.expiresAt) {
    imageStore.delete(hash)
    return undefined
  }

  return stored.buffer
}

export function removeImage(hash: string): void {
  imageStore.delete(hash)
}

export function clearImages(hashes: string[]): void {
  for (const hash of hashes) {
    imageStore.delete(hash)
  }
}
