import OpenAI from 'openai'

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is not set')
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export type MarketplaceListing = {
  store_name: string
  item_name: string
  quantity: number
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Heroic' | 'Epic' | 'Legendary'
  gold: number
  silver: number
  copper: number
}

export type ExtractionResult = {
  listings: MarketplaceListing[]
  tokenUsage: number
}

const EXTRACTION_PROMPT = `You are extracting marketplace listings from Ashes of Creation screenshots.

## VISUAL REFERENCE (Critical for accuracy)

**Currency identification is by COIN COLOR, not position:**
- GOLD coin: Yellow/golden colored circle
- SILVER coin: Grey/white colored circle
- COPPER coin: Orange/brown colored circle

**Rarity identification is by BORDER/TEXT COLOR:**
- Common: Grey/white text
- Uncommon: Green
- Rare: Blue
- Heroic: Purple
- Epic: Dark purple/magenta
- Legendary: Gold/orange

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
- The most common error is assuming the first number is gold. RESIST this assumption.`

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function extractMarketplaceData(
  imageBuffer: Buffer
): Promise<ExtractionResult> {
  const maxRetries = 3
  const baseDelay = 1000
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const base64Image = imageBuffer.toString('base64')
      const mimeType = imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8
        ? 'image/jpeg'
        : 'image/png'

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
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
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No content in OpenAI response')
      }

      const parsed = JSON.parse(content)

      if (!parsed.listings || !Array.isArray(parsed.listings)) {
        throw new Error('Invalid response format: missing or invalid listings array')
      }

      const tokenUsage = response.usage?.total_tokens || 0

      return {
        listings: parsed.listings,
        tokenUsage,
      }
    } catch (error) {
      lastError = error as Error

      if (error instanceof OpenAI.APIError) {
        if (error.status === 429) {
          const delay = baseDelay * Math.pow(2, attempt)
          console.error(`OpenAI rate limit hit. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)

          if (attempt < maxRetries - 1) {
            await sleep(delay)
            continue
          }
        } else if (error.status === 401) {
          throw new Error('OpenAI API authentication failed. Check your API key.')
        } else if (error.status === 500 || error.status === 503) {
          const delay = baseDelay * Math.pow(2, attempt)
          console.error(`OpenAI server error. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)

          if (attempt < maxRetries - 1) {
            await sleep(delay)
            continue
          }
        }
      }

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt)
        console.error(`Error processing image: ${error}. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
        await sleep(delay)
      } else {
        throw new Error(`Failed to extract marketplace data after ${maxRetries} attempts: ${lastError?.message}`)
      }
    }
  }

  throw new Error(`Failed to extract marketplace data after ${maxRetries} attempts: ${lastError?.message}`)
}
