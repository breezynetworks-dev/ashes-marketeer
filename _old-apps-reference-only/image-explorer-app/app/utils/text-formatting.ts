/**
 * Removes quotation marks from a string
 */
export function removeQuotes(str: string): string {
  if (!str) return ""

  // Remove both double and single quotes from the beginning and end of the string
  return str.replace(/^["']|["']$/g, "").trim()
}

/**
 * Converts a string to title case (first letter of each word capitalized)
 */
export function toTitleCase(str: string): string {
  if (!str) return ""

  // First remove any quotation marks
  const cleanStr = removeQuotes(str)

  return cleanStr
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

/**
 * Cleans up a store name by removing common prefixes and standardizing format
 */
export function cleanStoreName(name: string): string {
  if (!name) return ""

  // First remove any quotation marks
  const cleanName = removeQuotes(name)

  // Remove common prefixes like "Store: " or "Shop: "
  let cleaned = cleanName.replace(/^(store|shop|merchant|vendor)\s*:\s*/i, "")

  // Remove any trailing "Store" or "Shop"
  cleaned = cleaned.replace(/\s+(store|shop|merchant|vendor)$/i, "")

  return cleaned
}

