import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI, type CachedContent } from '@google/genai'

// Cache for Gemini prompt caching
let geminiPromptCache: CachedContent | null = null
let geminiCacheModel: string | null = null

export type AIModel =
  | 'gpt-5.2'
  | 'gemini-3-pro-preview'
  | 'gemini-3-flash-preview'
  | 'claude-opus-4-5'
  | 'claude-sonnet-4-5'
  | 'o4-mini'

export type ModelConfig = {
  value: AIModel
  label: string
  provider: string
  description: string
  maxConcurrent: number      // Max parallel requests
  delayBetweenMs: number     // Delay between requests in milliseconds
}

export const AI_MODELS: ModelConfig[] = [
  { value: 'gpt-5.2', label: 'GPT-5.2', provider: 'OpenAI', description: 'Best image perception', maxConcurrent: 5, delayBetweenMs: 50 },
  { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro', provider: 'Google', description: 'Best benchmarks overall', maxConcurrent: 10, delayBetweenMs: 50 },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', provider: 'Google', description: 'Best value if accurate', maxConcurrent: 10, delayBetweenMs: 50 },
  { value: 'claude-opus-4-5', label: 'Claude Opus 4.5', provider: 'Anthropic', description: 'Best reasoning, highest cost', maxConcurrent: 2, delayBetweenMs: 500 },
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', provider: 'Anthropic', description: 'Strong extraction, balanced', maxConcurrent: 3, delayBetweenMs: 300 },
  { value: 'o4-mini', label: 'o4-mini', provider: 'OpenAI', description: 'Budget option with reasoning', maxConcurrent: 5, delayBetweenMs: 50 },
]

export function getModelConfig(model: AIModel): ModelConfig {
  return AI_MODELS.find(m => m.value === model) || AI_MODELS[0]
}

export const DEFAULT_MODEL: AIModel = 'gemini-3-flash-preview'

export type NodeType = 'New Aela' | 'Halcyon' | 'Joeva' | 'Miraleth' | 'Winstead'

export type MarketplaceListing = {
  store_name: string
  item_name: string
  quantity: number
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Heroic' | 'Epic' | 'Legendary'
  gold: number
  silver: number
  copper: number
  node?: NodeType
}

export type CacheStatus = 'created' | 'reused' | 'unavailable'

export type ExtractionResult = {
  listings: MarketplaceListing[]
  tokenUsage: number
  cacheStatus?: CacheStatus
}

export const EXTRACTION_PROMPT = `You are extracting marketplace listings from Ashes of Creation screenshots.

## CONTEXT

Ashes of Creation is an MMORPG with a player-driven marketplace. Players list materials, equipment, and other items for sale at storefronts. Each listing displays the store name, item name, quantity, rarity tier, and price in a three-denomination currency system (gold, silver, copper). Your task is to accurately extract this structured data from screenshots.

## VISUAL REFERENCE (Critical for accuracy)

**Currency identification is by COIN COLOR, not position:**
- GOLD coin: Yellow/golden colored circle (most valuable, leftmost when present)
- SILVER coin: Grey/white colored circle (medium value)
- COPPER coin: Orange/brown colored circle (least valuable, rightmost when present)

**Rarity identification is by BORDER/TEXT COLOR:**
- Common: White text (most frequent, lowest value items)
- Uncommon: Green text
- Rare: Blue text
- Heroic: Gold/bronze text
- Epic: Purple text
- Legendary: Orange text (rarest, highest value items)

**Additional visual cues:**
- Store names appear at the top of the storefront panel
- Item icons appear on the left side of each row
- Quantity is displayed with an "x" prefix (e.g., "x5" means quantity of 5)
- The Materials tab contains crafting resources, ores, wood, etc.

## MANDATORY EXTRACTION PROCESS

For EACH item's price, you MUST follow this exact sequence:

STEP 1: Count how many coin icons are displayed (1, 2, or 3)
STEP 2: For each coin LEFT to RIGHT, identify its COLOR:
        - Yellow/gold tint = GOLD
        - Grey/white/silver tint = SILVER
        - Orange/brown/copper tint = COPPER
STEP 3: Match each number to its adjacent coin's color
STEP 4: Fill in 0 for any currency type that has no coin displayed

EXAMPLE WALKTHROUGHS:

Example A: Screenshot shows "49" [grey coin] "50" [orange coin]
- Step 1: 2 coins visible
- Step 2: First coin is GREY (silver), second coin is ORANGE (copper)
- Step 3: 49 = silver, 50 = copper
- Step 4: No yellow coin present → gold = 0
- Result: gold: 0, silver: 49, copper: 50
- NOT: gold: 49, silver: 50, copper: 0 ← WRONG

Example B: Screenshot shows "55" [grey coin]
- Step 1: 1 coin visible
- Step 2: Coin is GREY (silver)
- Step 3: 55 = silver
- Step 4: No yellow coin → gold = 0, no orange coin → copper = 0
- Result: gold: 0, silver: 55, copper: 0
- NOT: gold: 55, silver: 0, copper: 0 ← WRONG

Example C: Screenshot shows "4" [yellow coin] "67" [grey coin] "50" [orange coin]
- Step 1: 3 coins visible
- Step 2: Yellow (gold), grey (silver), orange (copper)
- Step 3: 4 = gold, 67 = silver, 50 = copper
- Step 4: All present
- Result: gold: 4, silver: 67, copper: 50

Example D: Screenshot shows "1" [yellow coin] "20" [grey coin]
- Step 1: 2 coins visible
- Step 2: First coin is YELLOW (gold), second coin is GREY (silver)
- Step 3: 1 = gold, 20 = silver
- Step 4: No orange coin → copper = 0
- Result: gold: 1, silver: 20, copper: 0

## OUTPUT FORMAT

Return a JSON object with this structure:
{
  "reasoning": [
    "[store_name] | [item_name] | qty:[quantity] | [rarity] | COINS: [colors seen] | PRICES: [numbers] | RESULT: [g],[s],[c]"
  ],
  "verification": "VERIFICATION COMPLETE: No errors found" or "CORRECTED [item]: [reason]",
  "listings": [
    {
      "store_name": "string",
      "item_name": "string",
      "quantity": number,
      "rarity": "Common|Uncommon|Rare|Heroic|Epic|Legendary",
      "gold": number,
      "silver": number,
      "copper": number
    }
  ]
}

The "reasoning" array must contain one entry per item showing your coin color analysis.
The "verification" field confirms you checked for errors.
The "listings" array contains the final corrected data.

Return empty listings array if no marketplace data is visible.

## CRITICAL REMINDERS

- Position does NOT indicate currency type. "49 50" could be silver+copper, NOT gold+silver.
- When in doubt, look at the COIN COLOR next to each number.
- Common and Uncommon items very rarely cost gold. If you extracted gold for these, double-check.
- The most common error is assuming the first number is gold. RESIST this assumption.
- Always extract ALL visible listings from the screenshot, not just the first few.
- If a storefront has multiple pages or is partially visible, extract only what is clearly readable.`

function getProvider(model: AIModel): 'openai' | 'anthropic' | 'google' {
  if (model.startsWith('gpt-') || model.startsWith('o4-')) {
    return 'openai'
  }
  if (model.startsWith('claude-')) {
    return 'anthropic'
  }
  if (model.startsWith('gemini-')) {
    return 'google'
  }
  throw new Error(`Unknown model provider for: ${model}`)
}

function getMimeType(imageBuffer: Buffer): string {
  return imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8
    ? 'image/jpeg'
    : 'image/png'
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// OpenAI extraction
async function extractWithOpenAI(
  imageBuffer: Buffer,
  model: AIModel,
  signal?: AbortSignal
): Promise<ExtractionResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set. Required for OpenAI models.')
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  const encodeStart = performance.now()
  const base64Image = imageBuffer.toString('base64')
  const mimeType = getMimeType(imageBuffer)
  console.log(`[OpenAI] Base64 encode: ${(performance.now() - encodeStart).toFixed(0)}ms, size: ${(base64Image.length / 1024).toFixed(0)}KB`)

  const apiStart = performance.now()
  const response = await openai.chat.completions.create({
    model: model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: EXTRACTION_PROMPT,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 4096,
  }, { signal })
  console.log(`[OpenAI] API call: ${(performance.now() - apiStart).toFixed(0)}ms`)

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No content in OpenAI response')
  }

  const parsed = JSON.parse(content)

  if (!parsed.listings || !Array.isArray(parsed.listings)) {
    throw new Error('Invalid response format: missing or invalid listings array')
  }

  return {
    listings: parsed.listings,
    tokenUsage: response.usage?.total_tokens || 0,
  }
}

// Anthropic extraction
async function extractWithAnthropic(
  imageBuffer: Buffer,
  model: AIModel,
  signal?: AbortSignal
): Promise<ExtractionResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set. Required for Claude models.')
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const encodeStart = performance.now()
  const base64Image = imageBuffer.toString('base64')
  const mimeType = getMimeType(imageBuffer) as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  console.log(`[Anthropic] Base64 encode: ${(performance.now() - encodeStart).toFixed(0)}ms, size: ${(base64Image.length / 1024).toFixed(0)}KB`)

  // Map our model names to Anthropic's API model names
  const modelMap: Record<string, string> = {
    'claude-opus-4-5': 'claude-opus-4-5-20250514',
    'claude-sonnet-4-5': 'claude-sonnet-4-5-20250514',
  }

  const apiModel = modelMap[model] || model

  const apiStart = performance.now()
  const response = await anthropic.messages.create({
    model: apiModel,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: EXTRACTION_PROMPT + '\n\nRespond with valid JSON only.',
          },
        ],
      },
    ],
  }, { signal })
  console.log(`[Anthropic] API call: ${(performance.now() - apiStart).toFixed(0)}ms`)

  const textBlock = response.content.find(block => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in Anthropic response')
  }

  // Extract JSON from the response (may be wrapped in markdown code blocks)
  let jsonContent = textBlock.text.trim()
  const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    jsonContent = jsonMatch[1].trim()
  }

  const parsed = JSON.parse(jsonContent)

  if (!parsed.listings || !Array.isArray(parsed.listings)) {
    throw new Error('Invalid response format: missing or invalid listings array')
  }

  return {
    listings: parsed.listings,
    tokenUsage: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
  }
}

// Warm up the Gemini prompt cache (call before batch processing)
export async function warmupGeminiCache(model: AIModel): Promise<CacheStatus> {
  if (!process.env.GOOGLE_API_KEY) {
    return 'unavailable'
  }

  const genai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY,
  })

  const { status } = await getGeminiCache(genai, model)
  return status
}

// Get or create Gemini prompt cache
async function getGeminiCache(genai: GoogleGenAI, model: string): Promise<{ cache: CachedContent | null; status: CacheStatus }> {
  // If we have a cache for the same model, reuse it
  if (geminiPromptCache && geminiCacheModel === model) {
    // Check if cache is still valid (not expired)
    if (geminiPromptCache.expireTime) {
      const expireTime = new Date(geminiPromptCache.expireTime).getTime()
      if (expireTime > Date.now()) {
        console.log(`[Gemini] Using existing prompt cache: ${geminiPromptCache.name}`)
        return { cache: geminiPromptCache, status: 'reused' }
      }
    }
  }

  // Create a new cache
  try {
    const cacheStart = performance.now()
    const cache = await genai.caches.create({
      model: model,
      config: {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: EXTRACTION_PROMPT + '\n\nRespond with valid JSON only.',
              },
            ],
          },
        ],
        ttl: '3600s', // 1 hour cache
        displayName: 'marketplace-extraction-prompt',
      },
    })
    console.log(`[Gemini] Created prompt cache in ${(performance.now() - cacheStart).toFixed(0)}ms: ${cache.name}`)

    geminiPromptCache = cache
    geminiCacheModel = model
    return { cache, status: 'created' }
  } catch (error) {
    console.error('[Gemini] Failed to create prompt cache, falling back to uncached:', error)
    return { cache: null, status: 'unavailable' }
  }
}

// Google Gemini extraction
async function extractWithGoogle(
  imageBuffer: Buffer,
  model: AIModel,
  signal?: AbortSignal
): Promise<ExtractionResult> {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY environment variable is not set. Required for Gemini models.')
  }

  const genai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY,
  })

  const encodeStart = performance.now()
  const base64Image = imageBuffer.toString('base64')
  const mimeType = getMimeType(imageBuffer)
  console.log(`[Gemini] Base64 encode: ${(performance.now() - encodeStart).toFixed(0)}ms, size: ${(base64Image.length / 1024).toFixed(0)}KB`)

  // Try to get or create prompt cache
  const { cache, status: cacheStatus } = await getGeminiCache(genai, model)

  const apiStart = performance.now()
  let response

  if (cache?.name) {
    // Use cached prompt - only send the image
    response = await genai.models.generateContent({
      model: model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Image,
              },
            },
          ],
        },
      ],
      config: {
        cachedContent: cache.name,
        responseMimeType: 'application/json',
        maxOutputTokens: 8192,
        abortSignal: signal,
      },
    })
    console.log(`[Gemini] API call (cached prompt): ${(performance.now() - apiStart).toFixed(0)}ms`)
  } else {
    // Fallback: send full prompt with image
    response = await genai.models.generateContent({
      model: model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Image,
              },
            },
            {
              text: EXTRACTION_PROMPT + '\n\nRespond with valid JSON only.',
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        maxOutputTokens: 8192,
        abortSignal: signal,
      },
    })
    console.log(`[Gemini] API call (uncached): ${(performance.now() - apiStart).toFixed(0)}ms`)
  }

  const content = response.text
  if (!content) {
    throw new Error('No content in Google Gemini response')
  }

  // Extract JSON from the response (may be wrapped in markdown code blocks)
  let jsonContent = content.trim()
  const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    jsonContent = jsonMatch[1].trim()
  }

  let parsed: any
  try {
    parsed = JSON.parse(jsonContent)
  } catch (parseError) {
    console.error('Gemini returned invalid JSON:', jsonContent.substring(0, 500))
    throw new Error(`Failed to parse Gemini response as JSON: ${parseError}`)
  }

  // Handle various response structures Gemini might return
  let listings = parsed.listings
  if (!listings && parsed.data?.listings) {
    listings = parsed.data.listings
  }
  if (!listings && parsed.result?.listings) {
    listings = parsed.result.listings
  }
  if (!listings && Array.isArray(parsed)) {
    // Gemini might return the array directly
    listings = parsed
  }

  if (!listings || !Array.isArray(listings)) {
    console.error('Gemini response missing listings array. Keys:', Object.keys(parsed), 'Got:', JSON.stringify(parsed).substring(0, 500))
    throw new Error('Invalid response format: missing or invalid listings array')
  }

  // Use the found listings
  parsed.listings = listings

  // Gemini doesn't return detailed token usage in the same way
  const tokenUsage = response.usageMetadata?.totalTokenCount || 0

  return {
    listings: parsed.listings,
    tokenUsage,
    cacheStatus,
  }
}

export async function extractMarketplaceData(
  imageBuffer: Buffer,
  model: AIModel = DEFAULT_MODEL,
  signal?: AbortSignal
): Promise<ExtractionResult> {
  const maxRetries = 3
  const baseDelay = 1000
  let lastError: Error | null = null

  const provider = getProvider(model)

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Check if aborted before each attempt
    if (signal?.aborted) {
      throw new Error('Extraction aborted')
    }

    try {
      switch (provider) {
        case 'openai':
          return await extractWithOpenAI(imageBuffer, model, signal)
        case 'anthropic':
          return await extractWithAnthropic(imageBuffer, model, signal)
        case 'google':
          return await extractWithGoogle(imageBuffer, model, signal)
        default:
          throw new Error(`Unknown provider: ${provider}`)
      }
    } catch (error) {
      lastError = error as Error

      // Don't retry if aborted
      if (signal?.aborted || lastError.name === 'AbortError' || lastError.message.includes('aborted')) {
        throw new Error('Extraction aborted')
      }

      // Check for rate limits and retriable errors
      const errorMessage = lastError.message.toLowerCase()
      const isRateLimit = errorMessage.includes('rate limit') || errorMessage.includes('429')
      const isServerError = errorMessage.includes('500') || errorMessage.includes('503') || errorMessage.includes('server error')
      const isAuthError = errorMessage.includes('401') || errorMessage.includes('authentication') || errorMessage.includes('api key')

      // Don't retry auth errors
      if (isAuthError) {
        throw lastError
      }

      if (isRateLimit || isServerError) {
        const delay = baseDelay * Math.pow(2, attempt)
        console.error(`${provider} error. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)

        if (attempt < maxRetries - 1) {
          await sleep(delay)
          continue
        }
      }

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt)
        console.error(`Error processing image with ${model}: ${error}. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
        await sleep(delay)
      } else {
        throw new Error(`Failed to extract marketplace data after ${maxRetries} attempts: ${lastError?.message}`)
      }
    }
  }

  throw new Error(`Failed to extract marketplace data after ${maxRetries} attempts: ${lastError?.message}`)
}

// Check which providers have API keys configured
export function getAvailableProviders(): { openai: boolean; anthropic: boolean; google: boolean } {
  return {
    openai: !!process.env.OPENAI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    google: !!process.env.GOOGLE_API_KEY,
  }
}

// Check if a specific model can be used
export function isModelAvailable(model: AIModel): boolean {
  const provider = getProvider(model)
  const available = getAvailableProviders()
  return available[provider]
}
