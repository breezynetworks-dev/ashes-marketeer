import { extractMarketplaceData, type ExtractionResult } from './openai'
import { readFile } from 'fs/promises'
import { db, uploadHistory, marketplaceListings } from '@/db'
import { EventEmitter } from 'events'

export type BatchStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface FileToProcess {
  path: string
  filename: string
  hash: string
  isDuplicate?: boolean
}

export interface BatchResult {
  filename: string
  itemCount: number
  tokenUsage: number
  success: boolean
  error?: string
}

export interface BatchState {
  id: string
  files: FileToProcess[]
  status: BatchStatus
  currentIndex: number
  results: BatchResult[]
  errors: Map<string, string>
  totalTokens: number
  skippedCount: number
  eventEmitter: EventEmitter
  shouldAbandon: boolean
  shouldSkipCurrent: boolean
}

export type SSEEvent =
  | {
      type: 'progress'
      image: string
      itemCount: number
      tokenUsage: number
      batchIndex: number
      totalImages: number
    }
  | {
      type: 'thought'
      summary: string
    }
  | {
      type: 'duplicate'
      filename: string
    }
  | {
      type: 'retry'
      filename: string
      attempt: number
      maxAttempts: number
    }
  | {
      type: 'error'
      filename: string
      message: string
    }
  | {
      type: 'complete'
      totalItems: number
      totalTokens: number
      skippedCount: number
    }

// In-memory storage for batch states
const batchStates = new Map<string, BatchState>()

// Track which batches are currently processing to prevent duplicate processing
const processingBatches = new Set<string>()

export function createBatch(files: FileToProcess[]): string {
  const batchId = crypto.randomUUID()

  const state: BatchState = {
    id: batchId,
    files,
    status: 'pending',
    currentIndex: 0,
    results: [],
    errors: new Map(),
    totalTokens: 0,
    skippedCount: 0,
    eventEmitter: new EventEmitter(),
    shouldAbandon: false,
    shouldSkipCurrent: false,
  }

  // Increase max listeners to allow multiple SSE connections
  state.eventEmitter.setMaxListeners(50)

  batchStates.set(batchId, state)
  return batchId
}

export function getBatchState(batchId: string): BatchState | undefined {
  return batchStates.get(batchId)
}

export function isBatchProcessing(batchId: string): boolean {
  return processingBatches.has(batchId)
}

async function processImage(
  file: FileToProcess,
  maxRetries: number = 3
): Promise<{ result: ExtractionResult; attempts: number }> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const imageBuffer = await readFile(file.path)
      const result = await extractMarketplaceData(imageBuffer)
      return { result, attempts: attempt }
    } catch (error) {
      lastError = error as Error
      if (attempt < maxRetries) {
        continue
      }
    }
  }

  throw lastError || new Error('Unknown error during image processing')
}

export async function startBatchProcessing(batchId: string): Promise<void> {
  const state = batchStates.get(batchId)

  if (!state) {
    throw new Error(`Batch ${batchId} not found`)
  }

  // If already processing or completed, don't start again
  if (processingBatches.has(batchId) || state.status === 'completed') {
    return
  }

  // Mark as processing
  processingBatches.add(batchId)
  state.status = 'processing'

  try {
    // Use a transaction for the entire batch
    await db.transaction(async (tx) => {
      for (let i = state.currentIndex; i < state.files.length; i++) {
        // Check if batch should be abandoned
        if (state.shouldAbandon) {
          throw new Error('Batch abandoned by user')
        }

        const file = state.files[i]
        state.currentIndex = i

        // Check if current file should be skipped
        if (state.shouldSkipCurrent) {
          state.shouldSkipCurrent = false

          // Record skipped status
          await tx.insert(uploadHistory).values({
            fileName: file.filename,
            fileHash: file.hash,
            itemCount: 0,
            tokenUsage: 0,
            status: 'skipped',
            errorMessage: 'Skipped by user',
          })

          // Add result for skipped file
          state.results.push({
            filename: file.filename,
            itemCount: 0,
            tokenUsage: 0,
            success: true,
            error: 'Skipped by user',
          })

          state.skippedCount++

          const skipEvent: SSEEvent = {
            type: 'error',
            filename: file.filename,
            message: 'Skipped by user',
          }
          state.eventEmitter.emit('event', skipEvent)

          continue
        }

        // Check for duplicates
        if (file.isDuplicate) {
          const event: SSEEvent = {
            type: 'duplicate',
            filename: file.filename,
          }
          state.eventEmitter.emit('event', event)
          state.skippedCount++

          // Add result for skipped duplicate
          state.results.push({
            filename: file.filename,
            itemCount: 0,
            tokenUsage: 0,
            success: true,
            error: undefined,
          })
          continue
        }

        const thoughtEvent: SSEEvent = {
          type: 'thought',
          summary: `Processing ${file.filename}...`,
        }
        state.eventEmitter.emit('event', thoughtEvent)

        const maxRetries = 3
        let success = false
        let extractionResult: ExtractionResult | null = null
        let errorMessage: string | undefined

        try {
          const { result, attempts } = await processImage(file, maxRetries)
          extractionResult = result
          success = true

          // Emit retry events if there were retries
          if (attempts > 1) {
            for (let attempt = 1; attempt < attempts; attempt++) {
              const retryEvent: SSEEvent = {
                type: 'retry',
                filename: file.filename,
                attempt,
                maxAttempts: maxRetries,
              }
              state.eventEmitter.emit('event', retryEvent)
            }
          }

          // Save to database within transaction
          if (extractionResult.listings.length > 0) {
            await tx.insert(marketplaceListings).values(
              extractionResult.listings.map((listing) => ({
                itemName: listing.item_name,
                sellerName: listing.seller_name,
                quantity: listing.quantity,
                rarity: listing.rarity,
                priceGold: listing.gold,
                priceSilver: listing.silver,
                priceCopper: listing.copper,
                totalPriceCopper:
                  listing.gold * 10000 + listing.silver * 100 + listing.copper,
                node: listing.node || 'New Aela', // Default node if not specified
              }))
            )
          }

          // Record in upload history within transaction
          await tx.insert(uploadHistory).values({
            fileName: file.filename,
            fileHash: file.hash,
            itemCount: extractionResult.listings.length,
            tokenUsage: extractionResult.tokenUsage,
            status: 'success',
          })

          state.totalTokens += extractionResult.tokenUsage

          const progressEvent: SSEEvent = {
            type: 'progress',
            image: file.filename,
            itemCount: extractionResult.listings.length,
            tokenUsage: extractionResult.tokenUsage,
            batchIndex: i,
            totalImages: state.files.length,
          }
          state.eventEmitter.emit('event', progressEvent)

        } catch (error) {
          success = false
          errorMessage = error instanceof Error ? error.message : 'Unknown error'
          state.errors.set(file.filename, errorMessage)

          // Record failure in upload history within transaction
          await tx.insert(uploadHistory).values({
            fileName: file.filename,
            fileHash: file.hash,
            itemCount: 0,
            tokenUsage: 0,
            status: 'failed',
            errorMessage,
          })

          const errorEvent: SSEEvent = {
            type: 'error',
            filename: file.filename,
            message: errorMessage,
          }
          state.eventEmitter.emit('event', errorEvent)
        }

        // Add result
        state.results.push({
          filename: file.filename,
          itemCount: extractionResult?.listings.length || 0,
          tokenUsage: extractionResult?.tokenUsage || 0,
          success,
          error: errorMessage,
        })
      }
    })

    // Calculate total items
    const totalItems = state.results.reduce((sum, r) => sum + r.itemCount, 0)

    state.status = 'completed'
    state.currentIndex = state.files.length

    const completeEvent: SSEEvent = {
      type: 'complete',
      totalItems,
      totalTokens: state.totalTokens,
      skippedCount: state.skippedCount,
    }
    state.eventEmitter.emit('event', completeEvent)
    state.eventEmitter.emit('complete')
  } catch (error) {
    state.status = 'failed'

    // If abandoned, record all unprocessed files as abandoned
    if (state.shouldAbandon) {
      await db.transaction(async (tx) => {
        for (let i = state.currentIndex; i < state.files.length; i++) {
          const file = state.files[i]
          await tx.insert(uploadHistory).values({
            fileName: file.filename,
            fileHash: file.hash,
            itemCount: 0,
            tokenUsage: 0,
            status: 'abandoned',
            errorMessage: 'Batch abandoned by user',
          })
        }
      })
    }

    const errorEvent: SSEEvent = {
      type: 'error',
      filename: 'system',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
    state.eventEmitter.emit('event', errorEvent)
    state.eventEmitter.emit('error', error)
    throw error
  } finally {
    // Remove from processing set
    processingBatches.delete(batchId)
  }
}

export function abandonBatch(batchId: string): void {
  const state = batchStates.get(batchId)

  if (!state) {
    throw new Error(`Batch ${batchId} not found`)
  }

  // Set flag to trigger abandon in processing loop
  // This will cause transaction rollback
  state.shouldAbandon = true
}

export function skipFile(batchId: string): void {
  const state = batchStates.get(batchId)

  if (!state) {
    throw new Error(`Batch ${batchId} not found`)
  }

  if (state.currentIndex >= state.files.length) {
    throw new Error('No file to skip')
  }

  // Set flag to skip current file in processing loop
  state.shouldSkipCurrent = true
}
