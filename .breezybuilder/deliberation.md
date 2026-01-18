# Deliberation

Started: 2026-01-18
Project Type: Web App

---

## Round 1

### Developer

**Technical Concerns:**
- Gemini Vision rate limits: Google AI has aggressive rate limits (15 RPM free tier, 2000 RPM paid) — need queue with exponential backoff and user feedback on progress
- TimescaleDB schema design: Need to decide if marketplace_listings is a hypertable or regular table — hypertables require time partitioning
- Price storage format: Storing gold/silver/copper separately vs. normalizing to single currency unit — affects sorting and aggregation queries
- Image retention: Do we store uploaded images after AI processing, or discard them?

**Architecture Decisions (Proposed):**
- Database strategy: Use TimescaleDB exclusively (it's Postgres-compatible) — avoids dual DB setup
- Price normalization: Store as INTEGER copper_total alongside gold/silver/copper display fields for fast sorting
- AI processing queue: In-memory queue for MVP, upgrade path to Inngest/BullMQ if scaling
- Image handling: Store images temporarily during processing, delete after extraction

**Data Model (Proposed):**
- marketplace_listings: id, item_name, quantity, rarity (enum), price_gold, price_silver, price_copper, copper_total (computed), node (enum), seller_name, timestamp, created_at

**Questions:**
1. Multi-user or single-user deployment?
2. Typical batch size for image uploads?
3. Do you have legacy data to migrate?
4. Can users edit AI extractions before DB submission?
5. Should uploaded images be stored or discarded post-processing?

### Designer

**UX Concerns:**
- Navigation: Single-page app with tab/sidebar switching, or separate routes?
- Upload feedback: After submitting extracted data to DB, what happens?
- Market Sniper interaction: How should discount % selector work?
- Mobile priority: Which page matters most on mobile?

**User Flows (Proposed):**
- Upload: Drag images → See batch progress → Review extracted table → Edit if needed → Submit
- Market deals: Set discount % → Trigger search → See sortable table of deals
- Quick lookup: Type item name → Optional filters → See results

**Component Structure (Proposed):**
- ImageDropzone, BatchProgressIndicator, EditableDataTable, RarityBadge, PriceDisplay, SearchControls, DataTable

**Questions:**
1. Navigation structure: Single-page app with tabs, or separate routes for upload vs. review?
2. Post-upload flow: After submitting extracted data, where does user go?
3. Review page organization: Are manual search, bulk search, and Market Sniper separate tabs?
4. Mobile usage: Should tables be fully responsive or just horizontal-scroll?
5. Authentication: Is there a login page, or localhost-only for officers?
6. Filtered views from old app: Should review page have quick filter buttons (4+ gold, epics, legendaries)?
7. Historical price display: Should 14-day average show inline in table, or on hover/expand?

### Product

**Requirements Unclear:**
- What happens when Gemini AI misidentifies or fails to extract?
- Market sniper with items that have no history or <14 days data?
- Can multiple users upload simultaneously?
- Is there a submission review/approval step?
- What happens to outdated listings?

**Edge Cases:**
- Duplicate listings (same item, store, node): Overwrite, flag, or allow?
- Partial data extraction (no price or rarity): Block or allow incomplete?
- Node name changes or new nodes: Hardcoded or configurable?

**Scope Clarification Needed:**
- User management: Individual logins vs shared access?
- Data editing post-submission: Allowed? By whom?
- Admin controls needed?

**Questions:**
1. What happens when AI misidentifies or fails? Manual correction or reject/retry?
2. Items with no 14-day history: How should Market Sniper handle them?
3. Duplicate listings: Overwrite existing, flag for review, or allow duplicates?
4. Auth model: Simple shared password, or individual accounts?
5. Data expiration: Should old listings auto-expire?
6. Post-submission editing: Can users edit data after it's in the database?

### User Answers (Round 1)

**Deployment & Auth:**
- Single-user deployment (runs locally)
- No authentication needed

**Upload Flow:**
- Batch size typically 10-30, but must handle any amount
- No pre-submission editing — trust AI accuracy with modern models
- API errors: standard retry handling with best practices
- Keep images in folder with date format MM-DD-YYYY

**Data Management:**
- No legacy data to migrate
- Duplicates: overwrite old listing
- Keep data forever for historical trends (important for market analysis even if item can't be purchased anymore)
- Soft delete: rows can be deleted/quantity updated in market explorer, BUT keep historical record of item/price/date for trend analysis

**Review Page:**
- Separate pages for upload vs review
- Remove filtered views (4+ gold, epics, etc.) — was a personal snipe feature
- Remove Market Sniper, bulk search, crafting tabs — just want ONE robust market view with everything needed for purchase decisions based on data and history

**Progress/Upload Details (Important):**
- Show detailed progress: token usage, batch progress, item count
- Stream data and show high-level AI thought summary (like Claude does, not full thoughts)
- Handle retries with best practices
- If batch reuploaded, skip already-processed screenshots (keep upload history to detect duplicates)

**Mobile:**
- Desktop only

## Round 2

### Developer

(Agent lacked file access — technical analysis deferred to Round 3)

Key technical areas to address:
- Streaming architecture for progress/token display
- Soft delete with history preservation schema
- Duplicate image detection (filename vs hash)
- Overwrite logic for duplicate listings

### Designer

**Upload Progress UI (Proposed):**
- UploadDropzone: drag-and-drop area, compresses when processing starts
- ProgressPanel: token usage, batch progress (X/Y images), item count (total extracted)
- AIThoughtsStream: auto-scrolling text area with Claude-style thought summaries per image
- RetryIndicator: icon + text showing retry attempt
- Completion state: success message, extracted count, "View in Market Explorer" button

**Market Explorer UI (Proposed):**
- Search bar (item name) + filters (rarity, node)
- Data table: Store, Item, Quantity, Rarity (badge), Price, Node, Timestamp, Actions
- Historical indicator: "14-day avg: X gold" inline or on hover
- Row actions: delete (soft), edit quantity
- Soft-deleted items: hidden by default, toggle to "Show deleted" (grayed out with strikethrough)
- Detail panel/modal: clicking row shows full trend history

**Questions:**
1. Upload error: If image fails after max retries, block batch or skip and continue?
2. Duplicate skip feedback: Show summary ("5 skipped, 3 new") or live stream each decision?
3. Soft delete behavior: Disappear immediately or stay visible with strikethrough?
4. Historical trends: Inline sparkline, expandable row, or side panel?
5. Should token usage be shown, or just batch progress?

### Product

**Scope Validation:**
- IN: Upload page, market explorer, historical trends, soft delete, duplicate overwrite, progress tracking
- OUT: Market Sniper, bulk search, crafting, filtered views, multi-user
- UNCLEAR: Is basic search/filter needed in market explorer? (not "bulk search" but find items)
- UNCLEAR: Export to CSV for sharing?

**Questions:**
1. Historical trends: What display helps you decide to buy? (line chart, price range, "last seen X days ago", avg comparison?)
2. Market explorer browsing: Primary sort/filter? (item name, price, last updated, rarity?)
3. Purchase decision goal: "Find cheapest current listing" or "Know if this price is historically good"?
4. Same item, multiple sellers at different prices: Show all listings or just cheapest?
5. Do you need basic search in market explorer to find items by name?
6. Export data to CSV for guild sharing?

### User Answers (Round 2)

**Upload Page:**
- On failure: Stop processing, flag the problematic image, give user option to skip it or abandon entire process
- Duplicate skip: Show as much info as possible (detailed streaming)
- Show both token usage AND batch progress

**Market Explorer:**
- Yes to search bar (search by word/name)
- Yes to filters (rarity/quality, etc.)
- Show ALL listings even if same item from multiple sellers — user might want to buy them all
- Primary browsing: all sorting options (item name, price, last updated, rarity) + search

**Historical Data:**
- For same item + same quality: aggregate into single daily price record in DB for history
- Display: Show price trend over time vs current price
- Time period: Configurable in app settings (default 14 days)

**Other:**
- Soft delete: Disappear immediately
- No CSV export needed

## Round 3

### Developer

**Proposed Database Schema:**
- `marketplace_listings`: id, item_name, seller_name, quantity, rarity (enum), price_gold, price_silver, price_copper, node, created_at, deleted_at (soft delete)
- `price_history` (TimescaleDB hypertable): id, item_name, rarity, date, avg_price, min_price, max_price, listing_count
- `upload_history`: id, file_name, file_hash (SHA-256), processed_at, item_count, token_usage, status, error_message
- `settings`: key, value (jsonb)

**Proposed Architecture:**
- SSE (Server-Sent Events) for streaming progress
- Daily aggregation job to snapshot prices into price_history
- Soft delete via deleted_at timestamp (rows stay in table but hidden)
- Duplicate detection via file_name + file_hash columns

**Questions:**
1. Duplicate detection: filename matching (simple) or file hash (reliable if renamed)?
2. Upload history retention: keep indefinitely or expire after X days?

### Designer

**Proposed Upload Page Layout:**
- UploadDropzone: full-width when idle, compresses to header during processing
- ProgressPanel: token usage, batch X/Y, item count (horizontal layout, live updates)
- AIThoughtsStream: scrollable textarea with per-image summaries, auto-scroll
- ErrorCard: thumbnail + filename + error message + "Skip & Continue" / "Abandon Batch" buttons
- CompletionCard: checkmark, "Processed X images, extracted Y items", "Go to Market Explorer" button

**Proposed Market Explorer Layout:**
- Top bar: search input + rarity dropdown + node dropdown + time period selector
- Data table: Store, Item, Quantity, Rarity (badge), Price (g/s/c), Node, Timestamp, Actions
- Sortable columns, no pagination (show all)
- Delete: instant remove with undo toast (3 seconds)
- Edit quantity: modal dialog

**Questions:**
1. Price trend display: inline sparkline, comparison indicator (↑10g vs avg), or expandable row with chart?
2. Time period setting: global settings page, or inline dropdown on Market Explorer?
3. Soft delete: instant remove with undo toast, or confirmation dialog first?

### Product

**MVP Scope Validated:**
- IN: Upload page, Market Explorer, search/filter/sort, historical trends, soft delete, quantity update, settings
- OUT: Market Sniper, bulk search, crafting, filtered views, CSV export, multi-user

**Questions:**
1. What defines a "duplicate" for skip logic? Same screenshot image, or same Store+Item+Price data?
2. Can users ever view/restore soft-deleted items, or hidden forever?
3. Edit quantity: is this for tracking "I bought some" or for correcting AI errors?

### User Answers (Round 3)

**Duplicate Detection:**
- Same filename on the same day = duplicate (skip it)

**Upload History:**
- Keep for 6 months
- Add app setting to clear historical data with "last X days" option
- Show warning before clearing

**Price Trend Display:**
- Simple comparison indicator (↑10g above avg, ↓5g below avg)

**Settings:**
- Dedicated settings page

**Edit/Delete Behavior (Clarified):**
- Purpose: BOTH tracking purchases AND correcting AI errors
- User wants flexibility to correct mistakes (e.g., AI extracted 99g instead of 99s)
- Options discussed:
  - Delete with history preserved
  - Delete without history
  - Inline correction that updates both current AND historical
- User open to best practice recommendation

**Best Practice Recommendation:**
- Allow inline editing of ANY field (quantity, price, rarity, item name, etc.)
- Edits update the current listing immediately
- When listing is later aggregated to price_history, the corrected value is used
- Delete = soft delete (hidden from view, but corrected price still flows to history)
- This way: correct first, then delete if needed — history always reflects accurate data

## Round 4

### Developer

**Implementation Decisions (No User Input Needed):**
- Add `total_price_copper` computed column for sorting/comparison
- SSE reconnection: client tracks last batch_index, server resumes from checkpoint
- Use Drizzle transaction for batch upload with rollback on failure
- Duplicate detection happens BEFORE Gemini processing (save API costs)
- Daily aggregation via scheduled job (not on every edit)

**Technical Notes:**
- price_history can be plain Postgres table with indexes (TimescaleDB hypertable optional for MVP scale)
- Soft delete queries use `WHERE deleted_at IS NULL` consistently

### Designer

**Implementation Decisions (No User Input Needed):**
- Undo toast: extend to 5 seconds for safety
- Inline edit: auto-save on blur (standard pattern)
- Settings page: accessible via nav header (gear icon or "Settings" link)
- Search input: 300ms debounce
- Disabled dropzone during processing

**Accessibility Confirmed:**
- Rarity badges with aria-label
- Price indicators with aria-label
- Keyboard navigation for all actions

### Product

**Clarifications (Already Answered):**
- Trend period: configurable, default 14 days
- Duplicate: same filename + same day
- Inline editing: ALL fields editable
- Clear history: global with warning, "last X days" option

### User Answers (Round 4)

**Batch Abandonment:** Discard — rollback everything if user abandons mid-processing.

## Round 5 (Final)

### Developer
Technical implementation details noted (rate limits, SSE resilience, hash algorithm, cleanup strategies, computed columns, aggregation timing). These are engineering decisions to be made during implementation — no user input required.

### Designer
NOTHING NEW

### Product
NOTHING NEW

---

## Deliberation Complete

All experts aligned. Ready to write spec.

