import { NextRequest } from 'next/server'
import { getBatchState, startBatchProcessing, type SSEEvent } from '@/lib/batch-processor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function formatSSEMessage(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const batchId = searchParams.get('batch_id')
  const lastIndexStr = searchParams.get('last_index')

  if (!batchId) {
    return new Response(
      JSON.stringify({ error: 'batch_id query parameter is required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  const batchState = getBatchState(batchId)

  if (!batchState) {
    return new Response(
      JSON.stringify({ error: `Batch ${batchId} not found` }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  const lastIndex = lastIndexStr ? parseInt(lastIndexStr, 10) : -1

  // Create SSE stream
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let eventListener: ((event: SSEEvent) => void) | null = null
      let completeListener: (() => void) | null = null
      let errorListener: ((error: Error) => void) | null = null

      try {
        // If reconnecting, send already completed results
        if (lastIndex >= 0 && batchState.results.length > 0) {
          for (let i = 0; i <= lastIndex && i < batchState.results.length; i++) {
            const result = batchState.results[i]
            const file = batchState.files[i]

            if (file.isDuplicate) {
              const event: SSEEvent = {
                type: 'duplicate',
                filename: file.filename,
              }
              controller.enqueue(encoder.encode(formatSSEMessage(event)))
            } else if (result.success) {
              const event: SSEEvent = {
                type: 'progress',
                image: result.filename,
                itemCount: result.itemCount,
                tokenUsage: result.tokenUsage,
                batchIndex: i,
                totalImages: batchState.files.length,
              }
              controller.enqueue(encoder.encode(formatSSEMessage(event)))
            } else if (result.error) {
              const event: SSEEvent = {
                type: 'error',
                filename: result.filename,
                message: result.error,
              }
              controller.enqueue(encoder.encode(formatSSEMessage(event)))
            }
          }
        }

        // If batch is already completed, send complete event and close
        if (batchState.status === 'completed') {
          const totalItems = batchState.results.reduce(
            (sum, r) => sum + r.itemCount,
            0
          )
          const failedCount = batchState.results.filter(r => !r.success).length

          const completeEvent: SSEEvent = {
            type: 'complete',
            totalItems,
            totalTokens: batchState.totalTokens,
            skippedCount: batchState.skippedCount,
            failedCount,
          }

          controller.enqueue(encoder.encode(formatSSEMessage(completeEvent)))
          controller.close()
          return
        }

        // Subscribe to batch events
        eventListener = (event: SSEEvent) => {
          // Skip events that were already sent during reconnection
          if (event.type === 'progress' && event.batchIndex <= lastIndex) {
            return
          }

          controller.enqueue(encoder.encode(formatSSEMessage(event)))
        }

        completeListener = () => {
          controller.close()
        }

        errorListener = (error: Error) => {
          console.error('Batch processing error:', error)
          controller.close()
        }

        batchState.eventEmitter.on('event', eventListener)
        batchState.eventEmitter.on('complete', completeListener)
        batchState.eventEmitter.on('error', errorListener)

        // Start batch processing if not already started
        startBatchProcessing(batchId).catch((error) => {
          console.error('Failed to start batch processing:', error)
        })

      } catch (error) {
        console.error('SSE stream error:', error)

        const errorEvent: SSEEvent = {
          type: 'error',
          filename: 'system',
          message: error instanceof Error ? error.message : 'Unknown error',
        }

        controller.enqueue(encoder.encode(formatSSEMessage(errorEvent)))
        controller.close()
      }
    },

    cancel() {
      // Cleanup when client disconnects
      const batchState = getBatchState(batchId)
      if (batchState) {
        batchState.eventEmitter.removeAllListeners('event')
        batchState.eventEmitter.removeAllListeners('complete')
        batchState.eventEmitter.removeAllListeners('error')
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
