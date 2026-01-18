import { NextResponse } from "next/server"
import { google } from "googleapis"

// Helper function to calculate average prices
function calculateAverages(historicalData: any[]) {
  // Group data by item+rarity combination
  const groupedData: { [key: string]: any[] } = {}

  historicalData.forEach((item) => {
    const key = `${item.item}|${item.rarity}`
    if (!groupedData[key]) {
      groupedData[key] = []
    }
    groupedData[key].push(item)
  })

  // Calculate averages for each group
  const averages: { [key: string]: { avgGold: number; avgSilver: number; avgCopper: number; avgTotalPrice: number } } =
    {}

  Object.keys(groupedData).forEach((key) => {
    const items = groupedData[key]
    const totalPrices = items.reduce((sum, item) => sum + item.totalPrice, 0)
    const avgTotalPrice = Math.round(totalPrices / items.length)

    // Convert back to gold/silver/copper
    const avgGold = Math.floor(avgTotalPrice / 10000)
    const remainder = avgTotalPrice % 10000
    const avgSilver = Math.floor(remainder / 100)
    const avgCopper = remainder % 100

    averages[key] = {
      avgGold,
      avgSilver,
      avgCopper,
      avgTotalPrice,
    }
  })

  return averages
}

// This function fetches data from Google Sheets
export async function GET() {
  try {
    // Configure Google Sheets API client
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    })

    const sheets = google.sheets({ version: "v4", auth })

    // Spreadsheet ID from the URL
    const spreadsheetId = "1IhEfAYcTTzv1sVjiQDBwaQFQsNG1RhZ7obQojcd-QJc"

    // Range to fetch (assuming data is in the first sheet)
    const range = "Sheet1!A:J" // Adjust if your sheet has a different name

    // Fetch data from Google Sheets
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    })

    const rows = response.data.values

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        {
          error: "No data found in the Google Sheet",
          details: "The sheet exists but contains no data. Please check if data has been added to the sheet.",
        },
        { status: 404 },
      )
    }

    // Extract headers from the first row
    const headers = rows[0]

    // Find the index of each column
    const dateIndex = headers.findIndex((h: string) => h.toLowerCase().includes("date"))
    const timestampIndex = headers.findIndex((h: string) => h.toLowerCase().includes("timestamp"))
    const nodeIndex = headers.findIndex((h: string) => h.toLowerCase().includes("node"))
    const storeIndex = headers.findIndex((h: string) => h.toLowerCase().includes("store"))
    const itemIndex = headers.findIndex((h: string) => h.toLowerCase().includes("item"))
    const quantityIndex = headers.findIndex((h: string) => h.toLowerCase().includes("quantity"))
    const rarityIndex = headers.findIndex((h: string) => h.toLowerCase().includes("rarity"))
    const goldIndex = headers.findIndex((h: string) => h.toLowerCase().includes("gold"))
    const silverIndex = headers.findIndex((h: string) => h.toLowerCase().includes("silver"))
    const copperIndex = headers.findIndex((h: string) => h.toLowerCase().includes("copper"))

    // Check if all required columns are present
    const missingColumns = []
    if (timestampIndex === -1) missingColumns.push("Timestamp")
    if (nodeIndex === -1) missingColumns.push("Node")
    if (storeIndex === -1) missingColumns.push("Store")
    if (itemIndex === -1) missingColumns.push("Item")
    if (quantityIndex === -1) missingColumns.push("Quantity")
    if (rarityIndex === -1) missingColumns.push("Rarity")
    if (goldIndex === -1) missingColumns.push("Gold")
    if (silverIndex === -1) missingColumns.push("Silver")
    if (copperIndex === -1) missingColumns.push("Copper")

    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          error: "Missing required columns in Google Sheet",
          details: `The following columns are missing: ${missingColumns.join(", ")}. Please check the sheet headers.`,
          foundHeaders: headers,
        },
        { status: 400 },
      )
    }

    // Map the data to our format (skip the header row)
    const allData = rows.slice(1).map((row: any) => {
      // Calculate total price for sorting
      const gold = Number.parseInt(row[goldIndex]) || 0
      const silver = Number.parseInt(row[silverIndex]) || 0
      const copper = Number.parseInt(row[copperIndex]) || 0
      const totalPrice = gold * 10000 + silver * 100 + copper

      return {
        // We're ignoring the date column as requested
        timestamp: row[timestampIndex] || "",
        node: row[nodeIndex] || "",
        storeName: row[storeIndex] || "",
        item: row[itemIndex] || "",
        quantity: Number.parseInt(row[quantityIndex]) || 0,
        rarity: row[rarityIndex] || "",
        gold,
        silver,
        copper,
        totalPrice,
      }
    })

    // Calculate the date 14 days ago
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

    // Filter data for historical analysis (last 14 days)
    const historicalData = allData.filter((item) => {
      try {
        const itemDate = new Date(item.timestamp)
        return !isNaN(itemDate.getTime()) && itemDate >= fourteenDaysAgo
      } catch (e) {
        return false
      }
    })

    // Calculate average prices from historical data
    const averagePrices = calculateAverages(historicalData)

    // Group data by node
    const nodeGroups: { [key: string]: any[] } = {}

    // First, group all data by node
    allData.forEach((item) => {
      if (!item.node) return // Skip items without a node

      if (!nodeGroups[item.node]) {
        nodeGroups[item.node] = []
      }

      nodeGroups[item.node].push(item)
    })

    // For each node, find the most recent timestamp
    const latestDataByNode: any[] = []

    Object.keys(nodeGroups).forEach((nodeName) => {
      const nodeData = nodeGroups[nodeName]

      // Find the most recent timestamp for this node
      let latestTimestamp = ""

      nodeData.forEach((item) => {
        if (item.timestamp > latestTimestamp) {
          latestTimestamp = item.timestamp
        }
      })

      // Only include data from the most recent timestamp for this node
      const latestNodeData = nodeData.filter((item) => item.timestamp === latestTimestamp)

      // Add this node's latest data to our result array
      latestDataByNode.push(...latestNodeData)
    })

    if (latestDataByNode.length === 0) {
      return NextResponse.json(
        {
          error: "No valid data found",
          details: "Could not find any valid data with timestamps in the sheet.",
        },
        { status: 404 },
      )
    }

    // Add average price data to the latest data
    const enrichedData = latestDataByNode.map((item) => {
      const key = `${item.item}|${item.rarity}`
      const avgData = averagePrices[key] || { avgGold: 0, avgSilver: 0, avgCopper: 0, avgTotalPrice: 0 }

      return {
        ...item,
        ...avgData,
      }
    })

    // Return the enriched data along with statistics
    return NextResponse.json({
      data: enrichedData,
      stats: {
        liveRows: latestDataByNode.length,
        liveNodes: Object.keys(nodeGroups).length,
        historicalRows: historicalData.length,
        historicalNodes: [...new Set(historicalData.map((item) => item.node))].length,
      },
    })
  } catch (error: any) {
    console.error("Error fetching data from Google Sheets:", error)

    // Determine the type of error for better error messages
    let errorMessage = "Failed to fetch data from Google Sheets"
    let errorDetails = error.message || "Unknown error occurred"
    const statusCode = 500

    // Handle specific Google API errors
    if (error.code === 403) {
      errorMessage = "Access denied to Google Sheet"
      errorDetails = "The service account doesn't have permission to access this sheet. Please check sharing settings."
    } else if (error.code === 404) {
      errorMessage = "Google Sheet not found"
      errorDetails = "The specified spreadsheet could not be found. Please check the spreadsheet ID."
    } else if (error.errors && error.errors.length > 0) {
      // Extract more detailed error information from Google API
      errorMessage = error.errors[0].message || errorMessage
      errorDetails = `Google API Error: ${error.errors[0].reason || "Unknown reason"}`
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: statusCode },
    )
  }
}

