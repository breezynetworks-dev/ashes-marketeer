import OpenAI from 'openai'

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is not set')
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export type MarketplaceListing = {
  seller_name: string
  item_name: string
  quantity: number
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Heroic' | 'Epic' | 'Legendary'
  gold: number
  silver: number
  copper: number
  node?: 'New Aela' | 'Halcyon' | 'Joeva' | 'Miraleth' | 'Winstead'
}

export type ExtractionResult = {
  listings: MarketplaceListing[]
  tokenUsage: number
}

const EXTRACTION_PROMPT = `You are analyzing a screenshot from the Ashes of Creation MMORPG marketplace.

Extract ALL marketplace listings visible in the image. For each listing, extract:
- seller_name: The name of the store/seller
- item_name: The name of the item being sold
- quantity: The number of items available (as a number)
- rarity: One of: Common, Uncommon, Rare, Heroic, Epic, Legendary
- gold: Gold price (as a number, 0 if not shown)
- silver: Silver price (as a number, 0 if not shown)
- copper: Copper price (as a number, 0 if not shown)
- node: The server/node name if visible in the screenshot. One of: New Aela, Halcyon, Joeva, Miraleth, Winstead. Omit this field if not visible.

Return a JSON object with this exact structure:
{
  "listings": [
    {
      "seller_name": "string",
      "item_name": "string",
      "quantity": number,
      "rarity": "Common|Uncommon|Rare|Heroic|Epic|Legendary",
      "gold": number,
      "silver": number,
      "copper": number,
      "node": "New Aela|Halcyon|Joeva|Miraleth|Winstead" (optional)
    }
  ]
}

Important:
- Extract ALL visible listings from the screenshot
- Use exact spelling from the screenshot
- If a price component is not shown, use 0
- Ensure rarity matches exactly one of the valid options
- Return an empty listings array if no marketplace data is visible`

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
