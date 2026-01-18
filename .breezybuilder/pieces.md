# Build Order

Generated: 2026-01-18
Total Pieces: 24
Total Phases: 6

---

## Phase 1: Database Foundation

Set up PostgreSQL/TimescaleDB with Drizzle ORM and create the core schema.

### Piece 1.1: Docker Database Setup
Type: config

Acceptance:
- [ ] docker-compose.yml creates TimescaleDB container on port 5432
- [ ] Database named 'ashes_marketeer' is created on container start
- [ ] Container persists data to local volume
- [ ] Connection string stored in .env.local file

Dependencies: none

Files: `docker-compose.yml`, `.env.local.example`, `.env.local`

---

### Piece 1.2: Drizzle Schema Definition
Type: schema

Acceptance:
- [ ] marketplace_listings table defined with all columns (id, item_name, seller_name, quantity, rarity enum, price_gold/silver/copper, total_price_copper, node enum, created_at, deleted_at)
- [ ] upload_history table defined with all columns (id, file_name, file_hash, processed_at, item_count, token_usage, status enum, error_message)
- [ ] price_history table defined with all columns (id, item_name, rarity, date, avg_price, min_price, max_price, listing_count)
- [ ] settings table defined with key-value JSONB schema
- [ ] All indexes specified: partial index on deleted_at IS NULL, item_name+rarity, created_at DESC, date indexes

Dependencies: 1.1

Files: `db/schema.ts`

Notes: Use Drizzle enums for rarity ('Common', 'Uncommon', 'Rare', 'Heroic', 'Epic', 'Legendary') and node ('New Aela', 'Halcyon', 'Joeva', 'Miraleth', 'Winstead') and status ('success', 'failed', 'skipped', 'abandoned')

---

### Piece 1.3: Drizzle Configuration and Migrations
Type: config

Acceptance:
- [ ] drizzle.config.ts configured with connection string and migrations path
- [ ] Initial migration generated from schema
- [ ] Migration successfully runs against Docker database
- [ ] db/index.ts exports typed drizzle instance

Dependencies: 1.2

Files: `drizzle.config.ts`, `db/index.ts`, `db/migrations/0000_initial.sql`

---

### Piece 1.4: Settings Seed Data
Type: schema

Acceptance:
- [ ] Default settings inserted: trend_period_days = 14, upload_retention_days = 180
- [ ] Seed script can be run idempotently (upsert pattern)
- [ ] npm script 'db:seed' executes seed file

Dependencies: 1.3

Files: `db/seed.ts`, `package.json`

---

◆ DEMO POINT: Database is running, schema is applied, can connect via Drizzle Studio or psql

---

## Phase 2: Upload Page — Core Flow

Wire up the existing upload page mockup to handle file uploads and OpenAI AI extraction.

### Piece 2.1: File Upload API Endpoint
Type: api

Acceptance:
- [ ] POST /api/upload/files accepts multipart form data with images
- [ ] Validates file types (PNG/JPEG only)
- [ ] Returns file metadata array (filename, size, hash) for client-side duplicate check
- [ ] Saves files to uploads/MM-DD-YYYY/ directory structure
- [ ] Generates SHA-256 hash for each file

Dependencies: 1.3

Files: `app/api/upload/files/route.ts`, `lib/file-utils.ts`

Notes: Don't process with OpenAI yet, just accept and store files

---

### Piece 2.2: Duplicate Detection API
Type: api

Acceptance:
- [ ] POST /api/upload/check-duplicates accepts array of {filename, hash, date}
- [ ] Queries upload_history WHERE file_name = ? AND processed_at::DATE = ?
- [ ] Returns array of {filename, isDuplicate: boolean}
- [ ] No database writes, read-only check

Dependencies: 1.3

Files: `app/api/upload/check-duplicates/route.ts`

---

### Piece 2.3: OpenAI Vision Integration
Type: integration

Acceptance:
- [ ] lib/openai.ts configures OpenAI client with API key from env
- [ ] extractMarketplaceData(imageBuffer) function sends image to GPT-4o-mini with vision
- [ ] Prompt instructs model to extract: seller_name, item_name, quantity, rarity, gold, silver, copper, node (inferred if visible)
- [ ] Returns structured JSON array of marketplace listings
- [ ] Handles API errors and rate limits with exponential backoff (max 3 retries)
- [ ] Tracks token usage and returns in response

Dependencies: none

Files: `lib/openai.ts`, `.env.local`

Notes: Use latest GPT model with vision capabilities. Test with sample marketplace screenshot.

---

### Piece 2.4: Batch Processing API with SSE
Type: api

Acceptance:
- [ ] POST /api/upload/process initiates batch processing, returns batch_id
- [ ] GET /api/upload/progress?batch_id=X streams SSE events with progress
- [ ] Events include: {type: 'progress', image: filename, itemCount, tokenUsage, batchIndex, totalImages}
- [ ] Events include: {type: 'thought', summary: string} for AI processing summaries
- [ ] Events include: {type: 'duplicate', filename} when duplicate detected
- [ ] Events include: {type: 'retry', filename, attempt, maxAttempts} on retry
- [ ] Events include: {type: 'error', filename, message} on failure after max retries
- [ ] Events include: {type: 'complete', totalItems, totalTokens, skippedCount}
- [ ] SSE connection supports reconnection from checkpoint (client sends last batch_index)

Dependencies: 2.1, 2.2, 2.3

Files: `app/api/upload/process/route.ts`, `app/api/upload/progress/route.ts`, `lib/batch-processor.ts`

Notes: Store batch state in memory (Map<batch_id, BatchState>) for MVP. Consider Redis for production.

---

### Piece 2.5: Save Extracted Data to Database
Type: api

Acceptance:
- [ ] Batch processor inserts all extracted listings into marketplace_listings in single transaction
- [ ] Calculates total_price_copper as (gold * 10000) + (silver * 100) + copper
- [ ] Creates upload_history record for each processed file with status, item_count, token_usage
- [ ] On "Abandon Batch" command, rollbacks entire transaction and sets status='abandoned'
- [ ] On "Skip & Continue" for failed image, sets status='failed' with error_message

Dependencies: 2.4

Files: `lib/batch-processor.ts` (modify), `app/api/upload/process/route.ts` (modify)

---

### Piece 2.6: Wire Upload Page to Real APIs
Type: frontend

Acceptance:
- [ ] Replace demo data in app/upload/page.tsx with real file upload
- [ ] UploadDropzone component calls /api/upload/files on drop
- [ ] Duplicate check runs before showing processing UI
- [ ] SSE connection established to /api/upload/progress with EventSource
- [ ] ProgressPanel updates from SSE events (token usage, batch progress, item count)
- [ ] AIThoughtsStream displays thought summaries from SSE
- [ ] DuplicateSkipIndicator shows when duplicate event received
- [ ] RetryIndicator shows retry attempts
- [ ] ErrorCard appears on error event with "Skip & Continue" / "Abandon Batch" buttons
- [ ] CompletionCard shows on complete event with item count and skipped count

Dependencies: 2.5

Files: `app/upload/page.tsx` (modify existing mockup)

Notes: Convert mockup from demo states to real SSE-driven updates. Keep existing component structure.

---

◆ DEMO POINT: Can drag-and-drop marketplace screenshots, see real-time processing with AI extraction, view extracted items in database

---

## Phase 3: Market Explorer — Core Display

Wire up the market explorer page to display real marketplace data with search and filters.

### Piece 3.1: Marketplace Listings API
Type: api

Acceptance:
- [ ] GET /api/listings returns all marketplace_listings WHERE deleted_at IS NULL
- [ ] Supports query params: search (item_name ILIKE), rarity, node
- [ ] Supports sortBy and sortOrder query params (default: created_at DESC)
- [ ] Returns listings with formatted data (seller, item, quantity, rarity, prices, node, timestamp)
- [ ] Includes total count in response

Dependencies: 1.3

Files: `app/api/listings/route.ts`

---

### Piece 3.2: Wire Market Explorer to Real Data
Type: frontend

Acceptance:
- [ ] Replace demo data in app/market/page.tsx with fetch from /api/listings
- [ ] SearchBar debounces input (300ms) and updates URL query params
- [ ] FilterControls (rarity, node) update URL query params on change
- [ ] DataTable fetches new data when query params change
- [ ] Column headers trigger sort (toggle ASC/DESC)
- [ ] RarityBadge renders with correct colors: Common gray, Uncommon green, Rare blue, Heroic purple, Epic magenta, Legendary orange
- [ ] PriceDisplay formats as "Xg Ys Zc" with color-coded text
- [ ] Timestamp displays relative time ("2 hours ago") or absolute ("Jan 18, 3:45 PM")
- [ ] Empty state shows "No marketplace data yet" when no listings
- [ ] Loading state shows skeleton rows while fetching

Dependencies: 3.1

Files: `app/market/page.tsx` (modify existing mockup), `components/ui/rarity-badge.tsx`, `components/ui/price-display.tsx`

Notes: Keep existing mockup layout, replace data source and add real filtering logic

---

◆ DEMO POINT: Can view uploaded marketplace data, search by item name, filter by rarity/node, sort columns

---

## Phase 4: Market Explorer — Edit and Delete

Add inline editing and soft delete with undo functionality.

### Piece 4.1: Update Listing API
Type: api

Acceptance:
- [ ] PATCH /api/listings/:id accepts partial updates (item_name, seller_name, quantity, rarity, price_gold, price_silver, price_copper, node)
- [ ] Recalculates total_price_copper on price changes
- [ ] Returns updated listing
- [ ] Returns 404 if listing not found or deleted_at IS NOT NULL

Dependencies: 3.1

Files: `app/api/listings/[id]/route.ts`

---

### Piece 4.2: Delete Listing API
Type: api

Acceptance:
- [ ] DELETE /api/listings/:id sets deleted_at = NOW()
- [ ] POST /api/listings/:id/undo clears deleted_at (restores listing)
- [ ] Both endpoints return success status
- [ ] Soft-deleted listings excluded from GET /api/listings

Dependencies: 3.1

Files: `app/api/listings/[id]/route.ts` (modify)

---

### Piece 4.3: Inline Edit Modal
Type: frontend

Acceptance:
- [ ] Clicking table row opens EditModal (or inline edit mode)
- [ ] All fields editable: item_name, seller_name, quantity, rarity (dropdown), price_gold/silver/copper, node (dropdown)
- [ ] Changes auto-save on blur or Enter keypress
- [ ] PATCH /api/listings/:id called on save
- [ ] Table row updates immediately on successful save
- [ ] Validation errors shown inline (e.g., negative quantity)
- [ ] ESC key cancels edit and reverts changes

Dependencies: 4.1

Files: `app/market/page.tsx` (modify), `components/market/edit-modal.tsx`

Notes: Reuse existing modal component from mockup, wire to API

---

### Piece 4.4: Soft Delete with Undo Toast
Type: frontend

Acceptance:
- [ ] Delete icon button on each table row
- [ ] Clicking delete immediately removes row from view and calls DELETE /api/listings/:id
- [ ] Toast appears with "Listing deleted" message and "Undo" button
- [ ] Toast auto-dismisses after 5 seconds
- [ ] Clicking Undo calls POST /api/listings/:id/undo and restores row
- [ ] If toast expires without undo, soft delete persists

Dependencies: 4.2

Files: `app/market/page.tsx` (modify), `components/ui/toast.tsx` (use shadcn/ui toast)

---

◆ DEMO POINT: Can edit any listing field inline, delete listings with undo option

---

## Phase 5: Historical Price Trends

Implement daily price aggregation and trend indicators.

### Piece 5.1: Daily Aggregation Job
Type: backend

Acceptance:
- [ ] lib/jobs/aggregate-prices.ts aggregates marketplace_listings by item_name, rarity, created_at::DATE
- [ ] Calculates avg_price, min_price, max_price, listing_count for each group
- [ ] Inserts/updates price_history records (upsert on item_name + rarity + date)
- [ ] Only aggregates listings WHERE deleted_at IS NULL
- [ ] npm script 'db:aggregate' runs aggregation manually
- [ ] Logs aggregation summary (X items, Y records created/updated)

Dependencies: 1.3

Files: `lib/jobs/aggregate-prices.ts`, `package.json`

Notes: For MVP, run manually. Can add cron scheduler later.

---

### Piece 5.2: Trend Calculation API
Type: api

Acceptance:
- [ ] GET /api/trends?item_name=X&rarity=Y&days=Z returns historical trend data
- [ ] Queries price_history WHERE item_name = X AND rarity = Y AND date >= (NOW() - Z days)
- [ ] Returns avg_price over time period and comparison to current price
- [ ] Returns sparkline data points (date, avg_price) for mini chart
- [ ] Handles "no history" case (returns empty array)

Dependencies: 5.1

Files: `app/api/trends/route.ts`

---

### Piece 5.3: Time Period Selector
Type: frontend

Acceptance:
- [ ] TimePeriodSelector dropdown in Market Explorer header
- [ ] Options: 7, 14, 30, 60, 90 days
- [ ] Default value loaded from settings API (trend_period_days)
- [ ] On change, updates settings and re-fetches trend data
- [ ] Selection persists across page reloads

Dependencies: 5.2

Files: `app/market/page.tsx` (modify), `components/market/time-period-selector.tsx`, `app/api/settings/route.ts`

---

### Piece 5.4: Trend Indicator Component
Type: frontend

Acceptance:
- [ ] TrendIndicator component in DataTable shows price comparison vs historical average
- [ ] Displays mini sparkline SVG (60x20px) with price history over selected time period
- [ ] Green line + "↓Xg below avg" for prices below average (good deal)
- [ ] Red line + "↑Xg above avg" for prices above average (overpriced)
- [ ] Gray line + "—" if price stable (within 5% of average)
- [ ] "No history" text if item+rarity has no price_history records
- [ ] Aria-label for accessibility

Dependencies: 5.2, 5.3

Files: `app/market/page.tsx` (modify), `components/market/trend-indicator.tsx`

Notes: Fetch trend data for each visible listing on table render. Consider batching API calls.

---

◆ DEMO POINT: Can see historical price trends with sparklines, identify good deals vs overpriced items, adjust time period

---

## Phase 6: Settings Page

Implement settings management and historical data cleanup.

### Piece 6.1: Settings CRUD API
Type: api

Acceptance:
- [ ] GET /api/settings returns all settings as key-value object
- [ ] GET /api/settings/:key returns single setting value
- [ ] PATCH /api/settings/:key updates setting value (upserts)
- [ ] Settings stored in settings table as JSONB

Dependencies: 1.3

Files: `app/api/settings/route.ts`, `app/api/settings/[key]/route.ts`

---

### Piece 6.2: Clear History API
Type: api

Acceptance:
- [ ] POST /api/history/clear accepts {keepDays: number | 'all'}
- [ ] Deletes upload_history records WHERE processed_at < (NOW() - keepDays)
- [ ] Deletes price_history records WHERE date < (NOW() - keepDays)
- [ ] If keepDays = 'all', deletes all records from both tables
- [ ] Returns count of deleted records {uploadHistory: X, priceHistory: Y}
- [ ] Does NOT delete marketplace_listings (as specified)

Dependencies: 1.3

Files: `app/api/history/clear/route.ts`

---

### Piece 6.3: Data Stats API
Type: api

Acceptance:
- [ ] GET /api/stats returns summary statistics
- [ ] Stats include: totalListings (active), totalUploads, totalItems, oldestUpload, newestUpload, avgItemsPerUpload, totalTokensUsed
- [ ] Queries marketplace_listings, upload_history tables
- [ ] All counts exclude deleted/abandoned records

Dependencies: 1.3

Files: `app/api/stats/route.ts`

---

### Piece 6.4: Wire Settings Page to Real APIs
Type: frontend

Acceptance:
- [ ] Replace demo data in app/settings/page.tsx with fetch from /api/settings and /api/stats
- [ ] TimePeriodSetting dropdown updates trend_period_days via PATCH /api/settings/trend_period_days
- [ ] Changes save immediately (auto-save pattern)
- [ ] ClearHistorySection dropdown with options (7, 14, 30, 60, 90, 180 days, All)
- [ ] Warning text updates based on selection
- [ ] "Clear History" button triggers confirmation dialog
- [ ] On confirm, calls POST /api/history/clear
- [ ] Success toast shows "Historical data cleared (kept last X days)" or "All historical data cleared"
- [ ] Button disabled if no historical data to clear
- [ ] Data stats section shows real counts from /api/stats

Dependencies: 6.1, 6.2, 6.3

Files: `app/settings/page.tsx` (modify existing mockup)

---

◆ DEMO POINT: Can configure trend time period, view data statistics, clear old historical data with confirmation

---

## Phase 7: Polish and Edge Cases

Add loading states, error handling, empty states, and accessibility improvements.

### Piece 7.1: Loading and Empty States
Type: frontend

Acceptance:
- [ ] Upload page shows skeleton loader while checking duplicates
- [ ] Market Explorer shows skeleton table rows while fetching listings
- [ ] Settings page shows skeleton stats while loading
- [ ] All empty states have helpful messages and call-to-action
- [ ] "No listings" empty state has "Go to Upload" button
- [ ] "No search results" shows search term and "Clear filters" option

Dependencies: none (apply across all pages)

Files: `app/upload/page.tsx`, `app/market/page.tsx`, `app/settings/page.tsx`, `components/ui/skeleton.tsx`

---

### Piece 7.2: Error Handling and Toasts
Type: frontend

Acceptance:
- [ ] All API calls wrapped in try-catch with error toasts
- [ ] Network errors show "Connection failed, please try again" toast
- [ ] Validation errors show inline error messages (form fields)
- [ ] OpenAI rate limit errors show "AI service rate limited, retrying..." toast with retry count
- [ ] Upload batch errors show ErrorCard with filename and error message
- [ ] Toast component has consistent styling and positioning

Dependencies: none (apply across all pages)

Files: All page files, `components/ui/toast.tsx`, `lib/error-handling.ts`

---

### Piece 7.3: Accessibility Improvements
Type: frontend

Acceptance:
- [ ] All interactive elements keyboard accessible (Tab, Enter, Space, Escape)
- [ ] RarityBadge has aria-label="Rarity: Epic"
- [ ] PriceDisplay has aria-label="10 gold, 50 silver, 25 copper"
- [ ] TrendIndicator has aria-label="5 gold above average" or "No price history"
- [ ] Delete button has aria-label="Delete listing"
- [ ] Edit modal has focus trap and ESC to close
- [ ] Form inputs have proper labels and error announcements
- [ ] SSE connection status announced to screen readers

Dependencies: none (apply across all pages)

Files: All component files, add aria-labels and keyboard handlers

---

### Piece 7.4: Home Page Dashboard
Type: frontend

Acceptance:
- [ ] Wire app/page.tsx to display real stats from /api/stats
- [ ] Show: total active listings, total uploads, avg items per upload, recent uploads count
- [ ] Quick action cards link to /upload and /market pages
- [ ] Recent activity section shows last 5 uploads with status
- [ ] Empty state shows "Get started by uploading marketplace screenshots"

Dependencies: 6.3

Files: `app/page.tsx` (modify existing mockup), `app/api/stats/route.ts`

---

◆ SHIP POINT: Project complete — all features implemented, polished, and accessible

---

## Piece Summary

| Piece | Type | Dependencies | Status |
|-------|------|--------------|--------|
| 1.1 Docker Database Setup | config | none | [x] |
| 1.2 Drizzle Schema Definition | schema | 1.1 | [x] |
| 1.3 Drizzle Configuration and Migrations | config | 1.2 | [x] |
| 1.4 Settings Seed Data | schema | 1.3 | [x] |
| 2.1 File Upload API Endpoint | api | 1.3 | [x] |
| 2.2 Duplicate Detection API | api | 1.3 | [x] |
| 2.3 OpenAI Vision Integration | integration | none | [x] |
| 2.4 Batch Processing API with SSE | api | 2.1, 2.2, 2.3 | [x] |
| 2.5 Save Extracted Data to Database | api | 2.4 | [x] |
| 2.6 Wire Upload Page to Real APIs | frontend | 2.5 | [x] |
| 3.1 Marketplace Listings API | api | 1.3 | [x] |
| 3.2 Wire Market Explorer to Real Data | frontend | 3.1 | [x] |
| 4.1 Update Listing API | api | 3.1 | [x] |
| 4.2 Delete Listing API | api | 3.1 | [x] |
| 4.3 Inline Edit Modal | frontend | 4.1 | [x] |
| 4.4 Soft Delete with Undo Toast | frontend | 4.2 | [x] |
| 5.1 Daily Aggregation Job | backend | 1.3 | [x] |
| 5.2 Trend Calculation API | api | 5.1 | [x] |
| 5.3 Time Period Selector | frontend | 5.2 | [x] |
| 5.4 Trend Indicator Component | frontend | 5.2, 5.3 | [x] |
| 6.1 Settings CRUD API | api | 1.3 | [x] |
| 6.2 Clear History API | api | 1.3 | [x] |
| 6.3 Data Stats API | api | 1.3 | [x] |
| 6.4 Wire Settings Page to Real APIs | frontend | 6.1, 6.2, 6.3 | [x] |
| 7.1 Loading and Empty States | frontend | none | [x] |
| 7.2 Error Handling and Toasts | frontend | none | [x] |
| 7.3 Accessibility Improvements | frontend | none | [x] |
| 7.4 Home Page Dashboard | frontend | 6.3 | [x] |
