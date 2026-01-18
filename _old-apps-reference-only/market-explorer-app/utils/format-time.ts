/**
 * Formats a timestamp into a relative time string (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: string): string {
  try {
    // Parse the timestamp
    const date = new Date(timestamp)

    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return timestamp // Return the original timestamp if parsing fails
    }

    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    // Less than a minute
    if (diffInSeconds < 60) {
      return "just now"
    }

    // Less than an hour
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`
    }

    // Less than a day
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600)
      return `${hours} ${hours === 1 ? "hour" : "hours"} ago`
    }

    // Less than a week
    if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400)
      return `${days} ${days === 1 ? "day" : "days"} ago`
    }

    // Format as date if older than a week
    return date.toLocaleDateString()
  } catch (error) {
    console.error("Error formatting relative time:", error)
    return timestamp // Return the original timestamp if there's an error
  }
}

