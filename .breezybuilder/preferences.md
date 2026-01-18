# Preferences

Your preferences for how projects should be built.

> **Note:** Do not rename or create custom headings. The following sections are expected by the planning agents:
> - `## Developer` — Technical preferences (stack, database, tools)
> - `## Designer` — Visual/UX preferences (components, patterns)
> - `## Product` — Product preferences (scope, MVP, user flows)

---

## Developer

- **Database:** PostgreSQL + Drizzle — Local Docker postgres:16, deploy remote later
- **Time-series:** TimescaleDB + Drizzle — Local Docker timescale/timescaledb, deploy remote later

---

## Designer

- **Stack:** BaseUI + shadcn/ui + Tailwind 4 (all components already installed)
- **Loading:** Skeleton for content, spinner for buttons
- **Empty:** Centered message with optional CTA
- **Error:** Inline for forms, toast for actions
- Always use default theme colors (e.g. using primary, secondary, etc. and don't just make up colors unless requested).

---

## Product

- Ship MVP first, iterate later
