"use server"

import { google } from "googleapis"
import { JWT } from "google-auth-library"
import type { CSVRow } from "../components/data-table"
import { toTitleCase, cleanStoreName, removeQuotes } from "../utils/text-formatting"

// Add the consolidated sheet URL as a constant at the top of the file, after the imports
const CONSOLIDATED_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1IhEfAYcTTzv1sVjiQDBwaQFQsNG1RhZ7obQojcd-QJc/edit?usp=sharing"

// Function to get the current date in the format "DD-MMM-YYYY" (e.g., "29-Mar-2025")
function getCurrentDateFormatted() {
  const date = new Date()
  const day = date.getUTCDate().toString().padStart(2, "0")
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" })
  const year = date.getUTCFullYear()
  return `${day}-${month}-${year}`
}

// Function to get the current timestamp in ISO format
function getCurrentTimestamp() {
  const now = new Date()
  return now.toISOString() // Returns format like: "2025-04-01T22:32:42.123Z"
}

// Extract the sheet ID from a Google Sheets URL
function extractSheetId(sheetUrl: string): string {
  const matches = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)
  if (!matches || !matches[1]) {
    throw new Error("Invalid Google Sheet URL")
  }
  return matches[1]
}

// Update the pushToGoogleSheets function to also push to the consolidated sheet
export async function pushToGoogleSheets(sheetUrl: string, data: CSVRow[], nodeName = "None") {
  try {
    if (!data || data.length === 0) {
      return {
        success: false,
        error: "No data to push to Google Sheets",
      }
    }

    // Get the sheet ID from the URL
    const sheetId = extractSheetId(sheetUrl)

    // Get the consolidated sheet ID
    const consolidatedSheetId = extractSheetId(CONSOLIDATED_SHEET_URL)

    // Get the current date formatted as "DD-MMM-YYYY" for the node-specific sheet
    const dateStr = getCurrentDateFormatted()

    // Get the current date formatted as "YYYY/MM/DD" for the consolidated sheet (UTC)
    const utcDate = new Date()
    const utcDateFormatted = `${utcDate.getUTCFullYear()}/${String(utcDate.getUTCMonth() + 1).padStart(2, "0")}/${String(utcDate.getUTCDate()).padStart(2, "0")}`

    // Get the current timestamp in ISO format
    const timestamp = getCurrentTimestamp()

    // Check if Google credentials are available
    const privateKey = process.env.GOOGLE_PRIVATE_KEY
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL

    if (!privateKey || !clientEmail) {
      // No fallback to CSV download, just return an error
      return {
        success: false,
        error: "Google credentials are not available. Please check your environment variables.",
      }
    }

    // Initialize auth with the service account credentials
    const auth = new JWT({
      email: clientEmail,
      key: privateKey.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })

    // Create Google Sheets API client
    const sheets = google.sheets({ version: "v4", auth })

    // FIRST: Push to the node-specific sheet (original functionality)
    // Get all sheets in the spreadsheet to check if our sheet exists
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    })

    // Check if a sheet with the current date exists
    let targetSheetId: number | null = null
    let isNewSheet = false

    if (spreadsheet.data.sheets) {
      for (const sheet of spreadsheet.data.sheets) {
        if (sheet.properties?.title === dateStr && sheet.properties?.sheetId !== undefined) {
          targetSheetId = sheet.properties.sheetId
          break
        }
      }
    }

    // If the sheet doesn't exist, create it
    if (targetSheetId === null) {
      const addSheetResponse = await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: dateStr,
                },
              },
            },
          ],
        },
      })

      // Get the ID of the newly created sheet
      if (addSheetResponse.data.replies && addSheetResponse.data.replies[0].addSheet?.properties?.sheetId) {
        targetSheetId = addSheetResponse.data.replies[0].addSheet.properties.sheetId
        isNewSheet = true
      }
    }

    // Always add headers for new sheets first as a separate operation
    if (isNewSheet) {
      const headerValues = [["Store Name", "Item", "Quantity", "Rarity", "Gold", "Silver", "Copper"]]

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${dateStr}!A1:G1`,
        valueInputOption: "RAW",
        requestBody: {
          values: headerValues,
        },
      })
    }

    // Apply text formatting to the data rows
    const formattedData = data.map((row) => ({
      ...row,
      storeName: cleanStoreName(toTitleCase(removeQuotes(row.storeName))),
      item: toTitleCase(removeQuotes(row.item)),
      rarity: toTitleCase(removeQuotes(row.rarity)),
    }))

    // Filter out any rows that look like headers (this is the fix)
    const filteredData = formattedData.filter((row) => {
      // Check if this row matches header pattern (case insensitive)
      const isHeaderRow =
        row.storeName.toLowerCase().includes("store") &&
        row.item.toLowerCase().includes("item") &&
        row.rarity.toLowerCase().includes("rarity")

      return !isHeaderRow
    })

    // Prepare the data rows to be written to the node-specific sheet
    const values = filteredData.map((row) => [
      row.storeName,
      row.item,
      row.quantity,
      row.rarity,
      row.gold,
      row.silver,
      row.copper,
    ])

    // Write the data rows to the node-specific sheet (starting from row 2 if it's a new sheet)
    if (values.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${dateStr}!A${isNewSheet ? 2 : 1}`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values,
        },
      })
    }

    // SECOND: Push to the consolidated sheet
    // Prepare the data rows for the consolidated sheet with Timestamp, Date and Node columns
    const consolidatedValues = filteredData.map((row) => [
      utcDateFormatted, // Date (Y/M/D) in UTC
      timestamp, // ISO format timestamp
      nodeName, // Node name from settings
      row.storeName,
      row.item,
      row.quantity,
      row.rarity,
      row.gold,
      row.silver,
      row.copper,
    ])

    // Write the data rows to the consolidated sheet (append only, no new tabs)
    if (consolidatedValues.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: consolidatedSheetId,
        range: "Sheet1!A1", // Assuming the sheet is named "Sheet1"
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: consolidatedValues,
        },
      })
    }

    return {
      success: true,
      message: `Successfully pushed ${filteredData.length} rows to Google Sheet "${dateStr}" and to the consolidated sheet`,
      // Don't include sheetOpenUrl to prevent automatic tab opening
    }
  } catch (error: any) {
    console.error("Google Sheets error:", error)
    return {
      success: false,
      error: error.message || "Failed to push data to Google Sheets",
    }
  }
}

