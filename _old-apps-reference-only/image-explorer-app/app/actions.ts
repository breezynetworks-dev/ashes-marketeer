"use server"

import { GoogleGenerativeAI } from "@google/generative-ai"

// WARNING: This is a development-only solution
export async function processImages(images: string[]) {
  try {
    // Check if API key is set
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set")
    }

    // Initialize the Google Generative AI SDK
    const genAI = new GoogleGenerativeAI(apiKey)

    // Set generation config
    const generationConfig = {
      temperature: 0,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 65536,
    }

    // Get the model with system instruction
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro-exp-03-25",
      systemInstruction: `The images you receive are screenshots of a marketplace on Ashes of Creation. 

You have two major requirements and they must be followed in this order:

1. Extract the store name (e.g. "John's Storefront"), the items listed (E.g. "Oak", the quantity (without the "x" part, e.g. "13") and the the rarity (e.g. "uncommon").
2. Extract each item values for gold, silver and copper. Not all of these will always be present for each item, and their digit position does NOT indicate the currency type (i.e. gold is NOT always the first set of numbers, it could be silver, or copper).
3. If any item values are missing (gold, silver and copper), you need to enter "0" for it. Remember that this is your value, this is not in the screenshot, this is based on what is missing.

Examples: 

You may see an item for 1 gold 20 silver but nothing about copper, this would be 1 gold 20 silver 0 copper (0 copper is not in the screenshot, this is logic decision by you).
You may see an item for 20 silver 50 copper but nothing about gold, this would be 0 gold 20 silver 50 copper (do NOT enter 20 silver as the gold value just because its the first set of numbers).
You may see an item for 11 silver but nothing about gold or copper, that would be 0 gold 11 silver and 0 copper (do NOT enter 11 silver as the gold value just because its the first set of numbers).

The easiest way to avoid mistakes is to remember that the position of the price numbers do NOT indicate what type of currency it is UNLESS all three are present in the screenshot.

Finally, once you have done your analysis (and followed the instructions above), identify any results that have a gold value in the data and DOUBLE CHECK that you have not made a mistake (e.g. using silver value as gold, instead of using 0 for gold, etc.)

Please output the CSV data.`,
    })

    // Then we create a chat session with this model:
    const chatSession = model.startChat({
      generationConfig,
      history: [],
    })

    // Prepare image parts for the message
    const imageParts = await Promise.all(
      images.map(async (img) => {
        // Extract base64 data from data URL if needed
        let base64Data = img
        if (img.startsWith("data:")) {
          base64Data = img.split(",")[1]
        }

        return {
          inlineData: {
            data: base64Data,
            mimeType: "image/jpeg", // Assuming JPEG, adjust if needed
          },
        }
      }),
    )

    // Send the message with images
    const result = await chatSession.sendMessage(imageParts)
    // This confirms that the system prompt is set when initializing the model and is used for all messages sent through the chat session.
    const responseText = result.response.text()

    // Process the response text to extract CSV data
    if (!responseText) {
      throw new Error("No response from Gemini")
    }

    // Split the response into lines and filter out any non-CSV lines
    const lines = responseText.split("\n").filter((line) => {
      // Make sure line is defined and is a string before calling methods on it
      if (!line || typeof line !== "string") return false

      // Check if it contains a comma and doesn't contain "store name"
      return line.includes(",") && !line.toLowerCase().includes("store name")
    })

    return { success: true, csv: lines.join("\n") }
  } catch (error: any) {
    console.error("Processing error:", error)
    return {
      success: false,
      error: error.message || "Failed to process images",
    }
  }
}

