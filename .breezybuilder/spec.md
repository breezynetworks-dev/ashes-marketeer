# Spec: Ashes Marketeer

## Summary
A consolidated marketplace data tool for the Fallen guild in Ashes of Creation. Officers upload marketplace screenshots which are processed by OpenAI AI to extract item listings. The data is stored in PostgreSQL and displayed in a searchable, sortable market explorer with historical price trends. This replaces two legacy apps (Market Uploader and Market Explorer) with a single, polished desktop application.

## Tech Stack
- **Framework:** Next.js (assumed from shadcn/ui + Tailwind 4 setup)
- **Database:** PostgreSQL 16 (Docker) + Drizzle ORM
- **Time-series:** TimescaleDB (Docker) + Drizzle
- **UI:** shadcn/ui + BaseUI + Tailwind 4 (already installed)
- **AI:** OpenAI (latest model with reasoning/thinking mode) for image extraction
- **Streaming:** Server-Sent Events (SSE)
- **Deployment:** Local single-user (no authentication)

## Pages

### Upload Page
**Purpose:** Drag-and-drop marketplace screenshots, batch process with OpenAI AI, review extracted data, submit to database.

**Components:**
- **UploadDropzone:** Full-width drag-and-drop area accepting PNG/JPEG. Shows instruction text and icon when idle. Compresses to header/status bar when processing starts. Disabled during processing.
- **ProgressPanel:** Horizontal layout showing:
  - Token usage (live count)
  - Batch progress (X/Y images)
  - Item count (total extracted items)
  - Updates in real-time via SSE
- **AIThoughtsStream:** Auto-scrolling text area displaying Claude-style thought summaries (high-level, not full thoughts) for each image. Streams per-image processing updates.
- **DuplicateSkipIndicator:** Shows when duplicate images are skipped (same filename on same day). Displays filename and "Skipped (duplicate)" status.
- **RetryIndicator:** Icon + text showing retry attempts when API errors occur. Uses exponential backoff with best practices.
- **ErrorCard:** Appears when image fails after max retries. Shows:
  - Thumbnail of failed image
  - Filename
  - Error message
  - Two buttons: "Skip & Continue" / "Abandon Batch"
- **CompletionCard:** Success state showing:
  - Checkmark icon
  - "Processed X images, extracted Y items" message
  - Summary: "Z skipped (duplicates)" if applicable
  - "Go to Market Explorer" button

**Behavior:**
- User drags images into dropzone
- On drop, files are checked against upload_history for duplicates (same filename + same date)
- Duplicates are skipped BEFORE OpenAI processing (save API costs)
- Non-duplicate images are sent to OpenAI AI for extraction
- Progress streams via SSE with reconnection support (client tracks batch_index, server resumes from checkpoint)
- Extracted data: Store Name, Item Name, Quantity, Rarity, Gold, Silver, Copper, Node (inferred or manual), Timestamp
- OpenAI rate limits handled with exponential backoff retry
- On error after max retries, show ErrorCard
- On "Abandon Batch", rollback entire transaction (discard all extracted data from this batch)
- On "Skip & Continue", mark failed image in upload_history and continue processing remaining images
- On success, save all extracted listings to database in single transaction
- Save images to folder: `uploads/MM-DD-YYYY/[filename]`
- Record upload_history entry with file_name, file_hash (SHA-256), processed_at, item_count, token_usage, status, error_message

**Edge Cases:**
- Empty dropzone: Show instruction text
- Processing interrupted: SSE reconnects from last checkpoint
- All images skipped (duplicates): Show completion with "0 new items"
- Invalid file type: Client-side validation before upload
- User navigates away mid-processing: Batch continues server-side, completion state shown on return

---

### Market Explorer Page
**Purpose:** Search, filter, sort marketplace listings. View historical price trends. Edit/delete listings.

**Components:**
- **SearchBar:** Text input with 300ms debounce. Searches item_name by word/partial match.
- **FilterControls:**
  - Rarity dropdown (All, Common, Uncommon, Rare, Heroic, Epic, Legendary)
  - Node dropdown (All, New Aela, Halcyon, Joeva, Miraleth, Winstead)
- **TimePeriodSelector:** Dropdown showing time period for historical averages (default: 30 days). Values: 7, 14, 30, 60, 90 days. Configurable in Settings.
- **DataTable:** Sortable columns:
  - Store (seller_name)
  - Item (item_name)
  - Quantity
  - Rarity (badge component with color: Common gray, Uncommon green, Rare blue, Heroic purple, Epic magenta, Legendary orange)
  - Price (formatted as Xg Ys Zc with colors: gold yellow, silver gray, copper amber)
  - Node
  - Timestamp (relative: "2 hours ago" or absolute: "Jan 18, 3:45 PM")
  - Trend (price comparison indicator: ↑10g above avg, ↓5g below avg, or "—" if no history)
  - Actions (edit, delete)
- **RarityBadge:** Color-coded badge with aria-label for accessibility
- **PriceDisplay:** Formatted price with gold/silver/copper icons or colors
- **TrendIndicator:** Sparkline chart + comparison vs historical average:
  - Mini SVG sparkline showing price history (60x20px)
  - Green line + "↓Xg" for prices below average (good deal)
  - Red line + "↑Xg" for prices above average (overpriced)
  - Gray line + "—" if stable or insufficient history
  - "No history" text if item+rarity has no price history
- **EditModal:** Inline editing for ALL fields:
  - Item Name (text input)
  - Seller Name (text input)
  - Quantity (number input)
  - Rarity (dropdown)
  - Price (gold/silver/copper inputs)
  - Node (dropdown)
  - Save button auto-commits on blur or Enter
  - Changes update marketplace_listings immediately
- **DeleteAction:** Soft delete with undo toast:
  - Click delete icon
  - Row disappears immediately (sets deleted_at timestamp)
  - Toast appears: "Listing deleted" with "Undo" button (5 seconds)
  - If Undo clicked, clears deleted_at and restores row
  - If toast expires, soft delete persists
- **SettingsLink:** Gear icon in nav header leading to Settings page

**Behavior:**
- On load, fetch all non-deleted listings (WHERE deleted_at IS NULL)
- Search input filters results client-side or server-side (300ms debounce)
- Dropdown filters apply immediately
- Clicking column header sorts ascending/descending
- Show ALL listings even if same item from multiple sellers (user may want to buy all)
- Table shows all results (no pagination)
- Edit: click row to open EditModal, changes save on blur
- Delete: instant soft delete with undo toast (5 seconds)
- Trend calculation: compare current price to avg price from price_history for matching item_name + rarity over selected time period
- If listing is edited, corrected values flow to next price_history aggregation

**Edge Cases:**
- No listings: Show empty state message "No marketplace data yet. Upload screenshots to get started."
- No search results: "No items match your search."
- Item has no price history: Show "—" in Trend column
- Same item, same rarity, different prices: Show all listings separately
- Edited listing: Changes apply immediately to current view, historical aggregation happens on daily job

---

### Settings Page
**Purpose:** Configure application settings and manage historical data.

**Components:**
- **TimePeriodSetting:** Dropdown to set default time period for historical averages (7, 14, 30, 60, 90 days). Default: 14 days.
- **ClearHistorySection:**
  - "Clear Historical Data" heading
  - Dropdown: "Keep last X days" (7, 14, 30, 60, 90, 180 days, All)
  - Warning text: "This will permanently delete upload history and price history older than X days. Marketplace listings are not affected."
  - "Clear History" button (destructive style)
  - Confirmation dialog: "Are you sure? This cannot be undone."
- **UploadHistoryRetention:** Display current retention policy (6 months) — informational only, not configurable in MVP

**Behavior:**
- Changes save immediately on selection (auto-save pattern)
- Clear History button triggers confirmation dialog
- On confirm, delete upload_history and price_history records older than selected threshold
- Show success toast: "Historical data cleared (kept last X days)"
- Settings stored in `settings` table (key-value JSON)

**Edge Cases:**
- Clear "All": Confirmation warns "This will delete ALL historical data"
- No historical data to clear: Button disabled with tooltip "No historical data to clear"

---

## Data Model

### marketplace_listings
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| item_name | VARCHAR(255) | Item name extracted from screenshot |
| seller_name | VARCHAR(255) | Store/seller name |
| quantity | INTEGER | Item quantity listed |
| rarity | ENUM | Common, Uncommon, Rare, Heroic, Epic, Legendary |
| price_gold | INTEGER | Gold component of price |
| price_silver | INTEGER | Silver component of price |
| price_copper | INTEGER | Copper component of price |
| total_price_copper | INTEGER | Computed: (gold * 10000) + (silver * 100) + copper, for sorting |
| node | ENUM | New Aela, Halcyon, Joeva, Miraleth, Winstead |
| created_at | TIMESTAMPTZ | When listing was uploaded |
| deleted_at | TIMESTAMPTZ | NULL if active, timestamp if soft-deleted |

**Indexes:**
- `WHERE deleted_at IS NULL` (partial index for active listings)
- `item_name, rarity` (for trend lookups)
- `created_at DESC` (for recent listings)

---

### price_history
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| item_name | VARCHAR(255) | Item name |
| rarity | ENUM | Rarity level |
| date | DATE | Aggregation date (one record per item+rarity per day) |
| avg_price | INTEGER | Average total_price_copper for that day |
| min_price | INTEGER | Minimum total_price_copper for that day |
| max_price | INTEGER | Maximum total_price_copper for that day |
| listing_count | INTEGER | Number of listings aggregated |

**Indexes:**
- `item_name, rarity, date DESC` (for trend queries)
- `date` (for cleanup/retention queries)

**Notes:**
- TimescaleDB hypertable optional for MVP (plain Postgres table with indexes is sufficient)
- Daily aggregation job runs at midnight (or on-demand trigger)
- Aggregates from marketplace_listings WHERE deleted_at IS NULL OR corrected data
- Edits to marketplace_listings flow into next aggregation (not retroactive)

---

### upload_history
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| file_name | VARCHAR(500) | Original filename |
| file_hash | VARCHAR(64) | SHA-256 hash of file contents |
| processed_at | TIMESTAMPTZ | When file was processed |
| item_count | INTEGER | Number of items extracted |
| token_usage | INTEGER | OpenAI API tokens used |
| status | ENUM | success, failed, skipped, abandoned |
| error_message | TEXT | NULL if success, error details if failed |

**Indexes:**
- `file_name, processed_at::DATE` (for duplicate detection on same day)
- `processed_at DESC` (for retention cleanup)

**Notes:**
- Duplicate detection: same filename + same day = skip
- Retention: 6 months (configurable cleanup in Settings)

---

### settings
| Column | Type | Description |
|--------|------|-------------|
| key | VARCHAR(100) | Setting name (primary key) |
| value | JSONB | Setting value (flexible schema) |

**Example records:**
- `trend_period_days`: `{"days": 14}`
- `upload_retention_days`: `{"days": 180}`

---

## Key Decisions

### Architecture
- **Single-user, local deployment:** No authentication, runs on localhost for guild officers
- **SSE for streaming:** Real-time progress updates with reconnection support (client tracks batch_index)
- **Transactional batch upload:** Rollback all data if user abandons mid-processing
- **Duplicate detection before AI:** Check upload_history BEFORE calling OpenAI API to save costs
- **Soft delete with history:** Deleted listings hidden from view (deleted_at IS NULL), but historical data preserved for trend analysis
- **Daily aggregation:** price_history populated by scheduled job, not on every edit
- **Image retention:** Store uploaded images in `uploads/MM-DD-YYYY/` forever (for reference)
- **Upload history retention:** 6 months default, configurable cleanup in Settings

### Design
- **Upload progress visibility:** Show token usage, batch progress, item count, AI thought summaries, retry indicators
- **Error handling:** Stop on failure, give user choice to skip or abandon batch
- **Inline editing:** All fields editable directly in table, auto-save on blur
- **Delete with undo:** 5-second toast with undo option for safety
- **Trend display:** Simple comparison indicator (↑/↓ vs avg) instead of charts/sparklines
- **Mobile:** Desktop-only (no mobile optimization needed)
- **Search:** 300ms debounce for performance
- **Sorting:** All columns sortable, default sort by created_at DESC

### Integration
- **OpenAI 2.5 Pro:** Image extraction with rate limiting (15 RPM free tier, 2000 RPM paid), exponential backoff retry
- **PostgreSQL + TimescaleDB:** TimescaleDB used exclusively (Postgres-compatible), no dual DB setup
- **Drizzle ORM:** Schema-first migrations, type-safe queries
- **Docker:** Local postgres:16 or timescale/timescaledb containers

### Scope
- **IN:**
  - Upload page with drag-and-drop, batch processing, progress streaming, duplicate detection
  - Market Explorer with search, filter, sort, inline editing, soft delete
  - Historical price trends with configurable time period
  - Settings page for time period and historical data cleanup
  - Image storage in dated folders
  - Upload history tracking with 6-month retention

- **OUT:**
  - Market Sniper (find deals below historical average)
  - Bulk search (multi-line item+rarity input)
  - Filtered views (4+ gold items, epics, legendaries)
  - Crafting/recipe upload
  - Charts/visualizations (recharts unused)
  - CSV export
  - Multi-user support
  - Authentication/login
  - Mobile responsiveness
  - Full guild access (officers only)

---

## Decomposition

### Suggested Phases

1. **Database Setup**
   - Docker compose for PostgreSQL/TimescaleDB
   - Drizzle schema definition (marketplace_listings, price_history, upload_history, settings)
   - Migration scripts
   - Seed data for testing (optional)

2. **Upload Page — Core Flow**
   - UploadDropzone component
   - File upload endpoint
   - OpenAI AI integration (image extraction)
   - Basic progress display
   - Save extracted data to marketplace_listings

3. **Upload Page — Advanced Features**
   - Duplicate detection (upload_history check)
   - SSE streaming for progress
   - AIThoughtsStream component
   - Retry logic with exponential backoff
   - Error handling (ErrorCard, skip/abandon)
   - Batch transaction with rollback
   - Image storage in dated folders

4. **Market Explorer — Core Flow**
   - DataTable component with sortable columns
   - Fetch and display marketplace_listings
   - Search bar with debounce
   - Rarity and Node filters
   - RarityBadge and PriceDisplay components

5. **Market Explorer — Edit/Delete**
   - EditModal with inline field editing
   - Update marketplace_listings endpoint
   - Soft delete logic (deleted_at timestamp)
   - Undo toast with 5-second timer
   - Accessibility (keyboard navigation, aria-labels)

6. **Historical Trends**
   - Daily aggregation job (price_history population)
   - TrendIndicator component
   - Trend calculation endpoint (compare current price to avg)
   - TimePeriodSelector component
   - Handle no-history edge case

7. **Settings Page**
   - Settings schema and CRUD endpoints
   - TimePeriodSetting component
   - ClearHistorySection with confirmation dialog
   - Historical data cleanup logic

8. **Polish & Testing**
   - Loading states (skeletons, spinners)
   - Empty states
   - Error states (toasts, inline messages)
   - Responsive layout (desktop-only, but clean sizing)
   - Cross-browser testing
   - Edge case validation

---

### Dependencies

- **Phase 1 (Database) → All other phases:** Schema must exist before any data operations
- **Phase 2 (Upload Core) → Phase 3 (Upload Advanced):** Basic upload must work before adding streaming/retries
- **Phase 4 (Explorer Core) → Phase 5 (Edit/Delete):** Table display must work before editing
- **Phase 4 (Explorer Core) → Phase 6 (Trends):** Listings must display before adding trend indicators
- **Phase 6 (Trends) + Phase 7 (Settings):** Can be parallel (both use settings table)
- **Phase 8 (Polish) → After all core features:** Final polish layer

---

### Piece Notes

**Upload Page:**
- Start with basic dropzone + file upload, then layer in OpenAI AI
- SSE can be stubbed initially (polling fallback), then upgraded
- Duplicate detection is critical — implement early to avoid wasted API calls
- Image storage path: use environment variable for base path, default to `uploads/`

**Market Explorer:**
- DataTable is reusable component — can be used on Upload page for preview if needed
- Soft delete queries: always filter `WHERE deleted_at IS NULL` — consider Drizzle helper
- Undo toast: use shadcn/ui toast component with custom 5-second duration
- Trend calculation: optimize query with indexed lookup on item_name + rarity

**Historical Trends:**
- Daily aggregation can be manual trigger for MVP, scheduled cron job for production
- Aggregation logic: GROUP BY item_name, rarity, created_at::DATE
- Handle edited listings: use current values in marketplace_listings (edits propagate forward)

**Settings:**
- Simple key-value store (JSONB column) allows future expansion without migrations
- Clear history: DELETE WHERE date < (NOW() - INTERVAL 'X days')
- Consider dry-run mode for testing cleanup logic

**Accessibility:**
- Rarity badges: aria-label="Rarity: Epic"
- Price indicators: aria-label="10 gold, 50 silver, 25 copper"
- Trend indicators: aria-label="5 gold above average"
- All actions keyboard-accessible (Enter to edit, Delete key for delete)

**Performance:**
- Batch upload: process images in parallel (respect rate limits)
- Search: client-side filter for <1000 rows, server-side for larger datasets
- Sorting: handle client-side for MVP, upgrade to server-side if needed
- Indexes: critical for deleted_at, item_name+rarity, created_at

---

## Mockup

Status: Complete
Files:
- `app/page.tsx` — Home/dashboard page with stats and quick actions
- `app/upload/page.tsx` — Upload page with all states (idle, processing, error, complete)
- `app/market/page.tsx` — Market Explorer with search, filters, sortable table, inline editing
- `app/settings/page.tsx` — Settings page with trend period, data stats, clear history
- `components/nav.tsx` — Shared navigation header

Note: Mockups use demo data. During implementation, replace demo data with real database queries and API calls.

---

## Open Items

None. All questions resolved during deliberation.
