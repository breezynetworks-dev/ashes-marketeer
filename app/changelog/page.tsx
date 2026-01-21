"use client"

import { ScrollText, Rocket } from "lucide-react"

const roadmap = [
  "Bulk delete market rows",
  "Export data to CSV",
  "Price alerts and notifications",
  "Historical price charts per item",
  "Community price submissions",
]

const changelog = [
  {
    version: "1.0.1",
    date: "January 21, 2026",
    changes: [
      "Added parallel processing for image uploads (10 concurrent requests)",
      "Added automatic retry queue for failed images",
      "Added AbortController support for cancelling uploads",
      "Added staggered request starts (150ms) for optimal API throughput",
      "Improved duplicate detection with SHA-256 file hashing",
      "Added prompt caching for Gemini models (90% token savings)",
      "Updated filter bar with Rarity, Node, and Trend Period dropdowns",
      "Moved database status and listing counts to bottom legend",
      "Increased table font sizes for better readability",
      "Added changelog page",
    ],
  },
  {
    version: "1.0.0",
    date: "Initial Release",
    changes: [
      "Initial release of Fallen Market Intel",
      "Screenshot upload with drag-and-drop and paste support",
      "AI-powered data extraction (GPT-5.2, Gemini 3 Pro, Gemini 3 Flash, Claude Sonnet 4)",
      "Real-time processing progress with Server-Sent Events",
      "Market Explorer with full-text search across items and stores",
      "Rarity filtering (Common, Uncommon, Rare, Epic, Legendary)",
      "Multi-node support (New Aela, Halcyon, Joeva, Miraleth, Winstead)",
      "Price trend analysis with sparkline visualizations",
      "Configurable trend periods (7, 14, 30 days)",
      "Statistics dashboard with market insights",
      "Price distribution charts and rarity breakdown",
      "Top items by price and store activity metrics",
      "Settings page with API key management",
      "Data management tools (clear history, clear all data)",
      "User authentication with login system",
      "Uploader tracking for contributions",
      "Dark theme UI with glass morphism design",
      "Responsive sidebar navigation",
      "PostgreSQL database with Drizzle ORM",
    ],
  },
]

export default function ChangelogPage() {
  return (
    <div className="px-8 py-6">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="size-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <ScrollText className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Updates</h1>
          <p className="text-sm text-muted-foreground">Version history and roadmap</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Changelog Column */}
        <div className="space-y-8">
          {changelog.map((release) => (
            <div key={release.version} className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold">v{release.version}</span>
                  <span className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary font-medium">
                    {release.version === changelog[0].version ? "Latest" : "Previous"}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">{release.date}</span>
              </div>
              <div className="p-6">
                <ul className="space-y-2">
                  {release.changes.map((change, index) => (
                    <li key={index} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <span className="text-primary mt-1">•</span>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Roadmap Column */}
        <div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
              <Rocket className="size-4 text-primary" />
              <span className="text-lg font-bold">Roadmap</span>
            </div>
            <div className="p-6">
              <ul className="space-y-3">
                {roadmap.map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="size-5 rounded-md border border-white/10 bg-white/5 flex items-center justify-center text-xs text-muted-foreground/50 shrink-0">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
