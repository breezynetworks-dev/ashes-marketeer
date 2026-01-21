import { extractMarketplaceData, warmupGeminiCache, type ExtractionResult, type AIModel, type CacheStatus, DEFAULT_MODEL, getModelConfig } from './ai-extraction'

export type NodeType = 'New Aela' | 'Halcyon' | 'Joeva' | 'Miraleth' | 'Winstead'
import { readFile } from 'fs/promises'
import { db, uploadHistory, marketplaceListings, settings } from '@/db'
import { eq } from 'drizzle-orm'
import { EventEmitter } from 'events'

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Update usage tracking for cost estimation (persists through database clears)
async function updateUsageTracking(tokens: number, images: number): Promise<void> {
  try {
    const [existing] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'usage_tracking'))

    const currentUsage = existing?.value as { totalTokens: number; totalImages: number } || { totalTokens: 0, totalImages: 0 }

    const newUsage = {
      totalTokens: currentUsage.totalTokens + tokens,
      totalImages: currentUsage.totalImages + images,
      lastUpdated: new Date().toISOString(),
    }

    if (existing) {
      await db.update(settings)
        .set({ value: newUsage })
        .where(eq(settings.key, 'usage_tracking'))
    } else {
      await db.insert(settings)
        .values({ key: 'usage_tracking', value: newUsage })
    }
  } catch (error) {
    console.error('Failed to update usage tracking:', error)
  }
}

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

export interface FailedFile {
  file: FileToProcess
  error: string
  attempts: number
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
  uploadedBy?: string
  node?: NodeType
  // New fields for parallel processing
  abortController: AbortController
  failedQueue: FailedFile[]
  retryPhase: boolean
  currentChunk: number
  totalChunks: number
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
      type: 'cache'
      status: CacheStatus
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
      failedCount: number
    }
  | {
      type: 'chunk-start'
      chunkIndex: number
      totalChunks: number
      filesInChunk: number
    }
  | {
      type: 'chunk-complete'
      chunkIndex: number
      successCount: number
      failedCount: number
    }
  | {
      type: 'retry-phase'
      failedCount: number
    }
  | {
      type: 'retry-complete'
      recoveredCount: number
      permanentFailures: number
    }
  | {
      type: 'queued-for-retry'
      filename: string
      error: string
    }

// In-memory storage for batch states (use globalThis for Next.js module isolation)
const globalForBatch = globalThis as unknown as {
  batchStates: Map<string, BatchState>
  processingBatches: Set<string>
}

if (!globalForBatch.batchStates) {
  globalForBatch.batchStates = new Map<string, BatchState>()
}
if (!globalForBatch.processingBatches) {
  globalForBatch.processingBatches = new Set<string>()
}

const batchStates = globalForBatch.batchStates
const processingBatches = globalForBatch.processingBatches

export function createBatch(files: FileToProcess[], uploadedBy?: string, node?: NodeType): string {
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
    uploadedBy,
    node,
    // Initialize parallel processing fields
    abortController: new AbortController(),
    failedQueue: [],
    retryPhase: false,
    currentChunk: 0,
    totalChunks: 0,
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
  model: AIModel,
  signal?: AbortSignal,
  maxRetries: number = 3
): Promise<{ result: ExtractionResult; attempts: number }> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Check if aborted before each attempt
    if (signal?.aborted) {
      throw new Error('Processing aborted')
    }

    try {
      const totalStart = performance.now()

      const readStart = performance.now()
      const imageBuffer = await readFile(file.path)
      console.log(`[Timing] File read: ${(performance.now() - readStart).toFixed(0)}ms, file size: ${(imageBuffer.length / 1024).toFixed(0)}KB`)

      const extractStart = performance.now()
      const result = await extractMarketplaceData(imageBuffer, model, signal)
      console.log(`[Timing] Extraction: ${(performance.now() - extractStart).toFixed(0)}ms`)
      console.log(`[Timing] Total for ${file.filename}: ${(performance.now() - totalStart).toFixed(0)}ms`)

      return { result, attempts: attempt }
    } catch (error) {
      lastError = error as Error

      // Don't retry if aborted
      if (signal?.aborted || lastError.message.includes('aborted')) {
        throw new Error('Processing aborted')
      }

      if (attempt < maxRetries) {
        continue
      }
    }
  }

  throw lastError || new Error('Unknown error during image processing')
}

async function getSelectedModel(): Promise<AIModel> {
  try {
    const [setting] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'ai_extraction_model'))

    if (setting?.value && typeof setting.value === 'object' && 'model' in setting.value) {
      return (setting.value as { model: AIModel }).model
    }
  } catch (error) {
    console.error('Failed to fetch AI model setting, using default:', error)
  }
  return DEFAULT_MODEL
}

// Helper to chunk an array into smaller arrays
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

// Process a single file and return result (used in parallel processing)
interface ProcessFileResult {
  file: FileToProcess
  success: boolean
  result?: ExtractionResult
  error?: string
  attempts: number
}

async function processFileForChunk(
  file: FileToProcess,
  model: AIModel,
  signal: AbortSignal,
  maxRetries: number = 3
): Promise<ProcessFileResult> {
  try {
    const { result, attempts } = await processImage(file, model, signal, maxRetries)
    return { file, success: true, result, attempts }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { file, success: false, error: errorMessage, attempts: maxRetries }
  }
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

  // Fetch selected AI model and its throttling config before processing
  const selectedModel = await getSelectedModel()
  const modelConfig = getModelConfig(selectedModel)
  const maxConcurrent = modelConfig.maxConcurrent
  const delayBetweenChunks = modelConfig.delayBetweenMs

  console.log(`Starting batch processing with AI model: ${selectedModel} (concurrent: ${maxConcurrent}, delay: ${delayBetweenChunks}ms)`)

  // Emit start message
  const startEvent: SSEEvent = {
    type: 'thought',
    summary: `Starting batch processing (${maxConcurrent} concurrent, ${state.files.length} images)`,
  }
  state.eventEmitter.emit('event', startEvent)

  // Warm up prompt cache for Gemini models before processing
  if (selectedModel.startsWith('gemini-')) {
    const cacheStatus = await warmupGeminiCache(selectedModel)
    if (cacheStatus !== 'unavailable') {
      const cacheEvent: SSEEvent = {
        type: 'cache',
        status: cacheStatus,
      }
      state.eventEmitter.emit('event', cacheEvent)
    }
  }

  try {
    // Filter out duplicates first and emit events for them
    const filesToProcess: FileToProcess[] = []
    for (const file of state.files) {
      if (file.isDuplicate) {
        const event: SSEEvent = {
          type: 'duplicate',
          filename: file.filename,
        }
        state.eventEmitter.emit('event', event)
        state.skippedCount++
        state.results.push({
          filename: file.filename,
          itemCount: 0,
          tokenUsage: 0,
          success: true,
          error: undefined,
        })
      } else {
        filesToProcess.push(file)
      }
    }

    // Create chunks for parallel processing
    const chunks = chunkArray(filesToProcess, maxConcurrent)
    state.totalChunks = chunks.length

    console.log(`Processing ${filesToProcess.length} files in ${chunks.length} chunks of ${maxConcurrent}`)

    // Process chunks in sequence, files within each chunk in parallel
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      // Check if batch should be abandoned
      if (state.shouldAbandon) {
        state.abortController.abort()
        throw new Error('Batch abandoned by user')
      }

      const chunk = chunks[chunkIndex]
      state.currentChunk = chunkIndex + 1

      // Emit chunk start event
      const chunkStartEvent: SSEEvent = {
        type: 'chunk-start',
        chunkIndex: chunkIndex + 1,
        totalChunks: chunks.length,
        filesInChunk: chunk.length,
      }
      state.eventEmitter.emit('event', chunkStartEvent)

      // Process all files in this chunk in parallel with staggered starts
      // This prevents all requests from hitting the API at exactly the same time
      const staggerDelayMs = 150 // Stagger each request by 150ms
      const chunkPromises = chunk.map((file, index) =>
        new Promise<ProcessFileResult>(async (resolve) => {
          // Stagger the start of each request within the chunk
          if (index > 0) {
            await sleep(index * staggerDelayMs)
          }
          const result = await processFileForChunk(file, selectedModel, state.abortController.signal)
          resolve(result)
        })
      )

      const chunkResults = await Promise.allSettled(chunkPromises)

      let chunkSuccessCount = 0
      let chunkFailedCount = 0

      // Process results and save to database
      await db.transaction(async (tx) => {
        for (const settledResult of chunkResults) {
          if (settledResult.status === 'rejected') {
            // This shouldn't happen since processFileForChunk catches errors
            continue
          }

          const { file, success, result, error, attempts } = settledResult.value

          if (success && result) {
            chunkSuccessCount++

            // Emit retry events if there were retries
            if (attempts > 1) {
              for (let attempt = 1; attempt < attempts; attempt++) {
                const retryEvent: SSEEvent = {
                  type: 'retry',
                  filename: file.filename,
                  attempt,
                  maxAttempts: 3,
                }
                state.eventEmitter.emit('event', retryEvent)
              }
            }

            // Save to database
            if (result.listings.length > 0) {
              await tx.insert(marketplaceListings).values(
                result.listings.map((listing) => ({
                  itemName: listing.item_name,
                  sellerName: listing.store_name,
                  quantity: listing.quantity,
                  rarity: listing.rarity,
                  priceGold: listing.gold,
                  priceSilver: listing.silver,
                  priceCopper: listing.copper,
                  totalPriceCopper:
                    listing.gold * 10000 + listing.silver * 100 + listing.copper,
                  node: state.node || 'New Aela',
                  uploadedBy: state.uploadedBy,
                }))
              )
            }

            // Record in upload history
            await tx.insert(uploadHistory).values({
              fileName: file.filename,
              fileHash: file.hash,
              itemCount: result.listings.length,
              tokenUsage: result.tokenUsage,
              status: 'success',
              uploadedBy: state.uploadedBy,
              node: state.node,
            })

            state.totalTokens += result.tokenUsage

            // Update persistent usage tracking
            await updateUsageTracking(result.tokenUsage, 1)

            // Emit progress event
            const progressEvent: SSEEvent = {
              type: 'progress',
              image: file.filename,
              itemCount: result.listings.length,
              tokenUsage: result.tokenUsage,
              batchIndex: state.currentIndex,
              totalImages: state.files.length,
            }
            state.eventEmitter.emit('event', progressEvent)

            // Add to results
            state.results.push({
              filename: file.filename,
              itemCount: result.listings.length,
              tokenUsage: result.tokenUsage,
              success: true,
            })

          } else {
            chunkFailedCount++

            // Add to failed queue for retry later (don't record in DB yet)
            state.failedQueue.push({
              file,
              error: error || 'Unknown error',
              attempts,
            })

            state.errors.set(file.filename, error || 'Unknown error')

            // Emit queued for retry event
            const queuedEvent: SSEEvent = {
              type: 'queued-for-retry',
              filename: file.filename,
              error: error || 'Unknown error',
            }
            state.eventEmitter.emit('event', queuedEvent)
          }

          state.currentIndex++
        }
      })

      // Emit chunk complete event
      const chunkCompleteEvent: SSEEvent = {
        type: 'chunk-complete',
        chunkIndex: chunkIndex + 1,
        successCount: chunkSuccessCount,
        failedCount: chunkFailedCount,
      }
      state.eventEmitter.emit('event', chunkCompleteEvent)

      // Apply delay between chunks (skip on last chunk)
      if (chunkIndex < chunks.length - 1 && delayBetweenChunks > 0) {
        await sleep(delayBetweenChunks)
      }
    }

    // === RETRY PHASE ===
    // Process failed files one at a time at the end
    if (state.failedQueue.length > 0 && !state.shouldAbandon) {
      state.retryPhase = true

      const retryPhaseEvent: SSEEvent = {
        type: 'retry-phase',
        failedCount: state.failedQueue.length,
      }
      state.eventEmitter.emit('event', retryPhaseEvent)

      let recoveredCount = 0
      let permanentFailures = 0

      // Process failed files one at a time (more conservative)
      for (const failedFile of state.failedQueue) {
        if (state.shouldAbandon) {
          state.abortController.abort()
          break
        }

        const retryEvent: SSEEvent = {
          type: 'retry',
          filename: failedFile.file.filename,
          attempt: 1,
          maxAttempts: 1,
        }
        state.eventEmitter.emit('event', retryEvent)

        // Wait a bit before retry
        await sleep(500)

        const retryResult = await processFileForChunk(
          failedFile.file,
          selectedModel,
          state.abortController.signal,
          1 // Single attempt for retry phase
        )

        await db.transaction(async (tx) => {
          if (retryResult.success && retryResult.result) {
            recoveredCount++

            // Save to database
            if (retryResult.result.listings.length > 0) {
              await tx.insert(marketplaceListings).values(
                retryResult.result.listings.map((listing) => ({
                  itemName: listing.item_name,
                  sellerName: listing.store_name,
                  quantity: listing.quantity,
                  rarity: listing.rarity,
                  priceGold: listing.gold,
                  priceSilver: listing.silver,
                  priceCopper: listing.copper,
                  totalPriceCopper:
                    listing.gold * 10000 + listing.silver * 100 + listing.copper,
                  node: state.node || 'New Aela',
                  uploadedBy: state.uploadedBy,
                }))
              )
            }

            await tx.insert(uploadHistory).values({
              fileName: failedFile.file.filename,
              fileHash: failedFile.file.hash,
              itemCount: retryResult.result.listings.length,
              tokenUsage: retryResult.result.tokenUsage,
              status: 'success',
              uploadedBy: state.uploadedBy,
              node: state.node,
            })

            state.totalTokens += retryResult.result.tokenUsage
            await updateUsageTracking(retryResult.result.tokenUsage, 1)

            const progressEvent: SSEEvent = {
              type: 'progress',
              image: failedFile.file.filename,
              itemCount: retryResult.result.listings.length,
              tokenUsage: retryResult.result.tokenUsage,
              batchIndex: state.currentIndex,
              totalImages: state.files.length,
            }
            state.eventEmitter.emit('event', progressEvent)

            state.results.push({
              filename: failedFile.file.filename,
              itemCount: retryResult.result.listings.length,
              tokenUsage: retryResult.result.tokenUsage,
              success: true,
            })

          } else {
            permanentFailures++

            // Record permanent failure
            await tx.insert(uploadHistory).values({
              fileName: failedFile.file.filename,
              fileHash: failedFile.file.hash,
              itemCount: 0,
              tokenUsage: 0,
              status: 'failed',
              errorMessage: retryResult.error || failedFile.error,
              uploadedBy: state.uploadedBy,
              node: state.node,
            })

            const errorEvent: SSEEvent = {
              type: 'error',
              filename: failedFile.file.filename,
              message: `Failed permanently: ${retryResult.error || failedFile.error}`,
            }
            state.eventEmitter.emit('event', errorEvent)

            state.results.push({
              filename: failedFile.file.filename,
              itemCount: 0,
              tokenUsage: 0,
              success: false,
              error: retryResult.error || failedFile.error,
            })
          }
        })

        // Small delay between retry attempts
        await sleep(300)
      }

      const retryCompleteEvent: SSEEvent = {
        type: 'retry-complete',
        recoveredCount,
        permanentFailures,
      }
      state.eventEmitter.emit('event', retryCompleteEvent)

      state.retryPhase = false
    }

    // Calculate totals
    const totalItems = state.results.reduce((sum, r) => sum + r.itemCount, 0)
    const failedCount = state.results.filter(r => !r.success).length

    state.status = 'completed'
    state.currentIndex = state.files.length

    const completeEvent: SSEEvent = {
      type: 'complete',
      totalItems,
      totalTokens: state.totalTokens,
      skippedCount: state.skippedCount,
      failedCount,
    }
    state.eventEmitter.emit('event', completeEvent)
    state.eventEmitter.emit('complete')

  } catch (error) {
    state.status = 'failed'

    // If abandoned, record all unprocessed files as abandoned
    if (state.shouldAbandon) {
      const processedFiles = new Set(state.results.map(r => r.filename))

      await db.transaction(async (tx) => {
        for (const file of state.files) {
          if (!processedFiles.has(file.filename) && !file.isDuplicate) {
            await tx.insert(uploadHistory).values({
              fileName: file.filename,
              fileHash: file.hash,
              itemCount: 0,
              tokenUsage: 0,
              status: 'abandoned',
              errorMessage: 'Batch abandoned by user',
              uploadedBy: state.uploadedBy,
              node: state.node,
            })
          }
        }

        // Also record any files still in failed queue as abandoned
        for (const failedFile of state.failedQueue) {
          if (!processedFiles.has(failedFile.file.filename)) {
            await tx.insert(uploadHistory).values({
              fileName: failedFile.file.filename,
              fileHash: failedFile.file.hash,
              itemCount: 0,
              tokenUsage: 0,
              status: 'abandoned',
              errorMessage: 'Batch abandoned by user',
              uploadedBy: state.uploadedBy,
              node: state.node,
            })
          }
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
  state.shouldAbandon = true

  // Abort any in-flight requests immediately
  state.abortController.abort()
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
