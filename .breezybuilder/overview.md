# Overview

Captured: 2026-01-18

---

## Project Vision

Build a consolidated, modern marketplace data tool for the **Fallen** guild in Ashes of Creation. This replaces two legacy applications ("The Night Shift" Market Uploader and Market Explorer) with a single polished tool designed for key guild members and officers.

## What The Old Apps Did

### App 1: Market Uploader (image-explorer-app)
- Drag-and-drop upload of marketplace screenshots
- Batch processing with Gemini 2.5 Pro AI to extract: Store Name, Item, Quantity, Rarity, Gold, Silver, Copper
- Rate limiting with configurable tiers
- Multiple filtered views (4+ gold items, rarity/price mismatches, epics, legendaries, shopping list)
- Inline editing of extracted data
- Export to Google Sheets (node-specific + consolidated)

### App 2: Market Explorer (market-explorer-app)
- Read from consolidated Google Sheet
- Manual search with item name, rarity, node filters
- Bulk search (multi-line item+rarity input)
- Market Sniper: find items cheaper than 14-day historical average by configurable discount %
- Sortable tables with rarity color badges
- Price display in gold/silver/copper format

## Major Changes for New App

### Consolidation
- Single app with both upload and data review functionality
- Upload/processing on one page, data exploration on another
- Unified navigation and consistent UI

### Database Migration
- Replace Google Sheets with PostgreSQL + Drizzle ORM
- TimescaleDB for time-series historical data
- Proper relational schema for items, prices, nodes, timestamps
- 14-day historical averages calculated from database

### Guild Rebrand
- Remove all "The Night Shift" branding
- New guild name: "Fallen"
- Target audience: key members and officers (not entire guild)

### UI Overhaul
- Completely rebuild UI with shadcn/ui components (already installed)
- Modern, polished, super usable design
- Clean upload flow with clear progress indicators
- Professional data tables with sorting/filtering

## Core Features to Implement

### Upload Page
1. Drag-and-drop image upload (PNG/JPEG)
2. Batch processing with Gemini AI
3. Rate limiting and progress tracking
4. Extracted data preview with inline editing
5. Validation and filtering of incomplete rows
6. Submit to database

### Data Review Page
1. Manual search (item name, rarity, node)
2. Bulk search (multi-line input)
3. Market Sniper (find deals below historical average)
4. Sortable tables with rarity color badges
5. Price display: gold (yellow), silver (gray), copper (amber)
6. Historical price comparison

### Data Model
- Store Name
- Item Name
- Quantity
- Rarity (Common, Uncommon, Rare, Heroic, Epic, Legendary)
- Price (Gold, Silver, Copper)
- Node (New Aela, Halcyon, Joeva, Miraleth, Winstead)
- Timestamp
- 14-day historical averages

## Tech Stack (from preferences.md)
- PostgreSQL + Drizzle (Docker postgres:16)
- TimescaleDB for time-series (Docker timescale/timescaledb)
- shadcn/ui + Tailwind 4 (already installed)
- Gemini AI for image processing

## Design Goals
- Super polished, modern UI
- Super usable and intuitive
- Clean upload flow
- Professional data exploration
- Mobile-friendly (officers may check on phones)

## Out of Scope
- Recipe upload (was stubbed but never implemented)
- Charts/visualizations (recharts was installed but unused)
- Full guild access (this is for officers only)
