# Evidence

## Pre-implementation Verification

**All records:**

- `matchingCount`: 8
- `openCount`: 6
- `overdueOpenCount`: 3
- `knownOpenHours`: 14
- `knownOpenCount`: 4
- `unknownOpenCount`: 2

**Filter `zone=North, status=open`:**

- `matchingCount`: 2
- `openCount`: 2
- `overdueOpenCount`: 1
- `knownOpenHours`: 4
- `knownOpenCount`: 1
- `unknownOpenCount`: 1

---

I got the `matchingCount` number by counting the total number of matching tickets (both open and closed). The `openCount` is just the matching tickets with `closed_on` being null. I counted the tickets for `overdueOpenCount` by seeing if the `opned_on` date is March 18th or before and `closed_on` also needs to be null. `knownOpenHours` was counted by looking at the sum of non-null estimates for open tickets where `closed_on` is null. I counted `knownOpenCount` by looking at the number of open tickets with a non-null `estimated_hours` value. This includes 0, as it is known, whereas null suggests it is unknown. `unknownOpenCount` was counted by looking at the open tickets where `estimated_hours` is null. 

**For example:** Ticket `T-00001` would be included with `knownOpenCount` as its `closed_on` is null and we have a number value for `estimated_hours`. This is the same for ticket `T-00005`, where the number is 0. Whereas for ticket `T-00007`, `closed_on` is null but so is `estimated_hours`. This ticket would therefore be included with `unknownOpenCount`. 

| ticket_id | zone | category | priority | opened_on | closed_on | estimated_hours | summary |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| T-00001 | North | Access | High | 2026-03-01 | | 4 | Entrance door sticks |
| T-00005 | Central | Technology | Normal | 2026-03-25 | | 0 | Lab kiosk needs "restart", not replacement |
| T-00007 | South | Access | High | 2026-03-01 | | | Lift inspection pending |

---

**Exported JSON files confirmed metrics match:** [All records](../evidence/analysis.json) | [Filtered by `zone=North, status=open`](../evidence/analysis-filters.json)

## Recommendation and Uncertainty

![Screenshot of matching records for `campus-tickets.csv`](../assets/recommendation.png)

While the North zone handles the highest total volume, the **South zone** warrants immediate investigation next month.

Although South contains fewer total tickets, **33 out of 40 are open**, with **23 heavily overdue** (dating back to January and February, well past the 14-day threshold). These comprise critical High-priority access and infrastructure issues. Furthermore, high estimate uncertainty (19 null `estimated_hours`) indicates the true operational burden may be substantially higher than reported `knownOpenHours`. Central remains the most manageable zone.

## Copilot Usage

**Prompt excerpt:**

> “When the user chooses the CSV file, it should be parsed with Papa Parse and should not use `split(",")`.”

**Copilot output excerpt:**

> “Use Papa Parse with comma-delimited parsing and dynamic typing disabled, so fields remain strings and quoted commas/newlines are handled correctly.”

**Action:** I accepted this approach and implemented it in [`parseCsv`](../src/lib/parseCsv.ts). Papa Parse returns string values, which are then validated by [`validateRecords`](../src/lib/validateRecords.ts).

**Why it's supported:** The A2 test in [`test/acceptance.test.ts`](../test/acceptance.test.ts) confirms quoted fields, embedded commas, doubled quotes, and multiline summaries are parsed and retained correctly.

## Quality checks and Test Status

```sh
# Run lint:
npm run lint

# Type-check the app
npx tsc -p tsconfig.app.json --noEmit

# Build the production site into `dist/`:
npm run build

# Preview a production build locally:
npm run preview

# Run Vitest tests
npm run test
```

**Automated Test Results (Vitest): PASS (3 cases):**

1. **A1 `verification.csv`:** Normalized records and all-record plus North/open metrics match independent expected values; blank and zero estimates differ.
2. **A2 `edge-cases.csv`:** Accepted/rejected/ignored counts, first-valid duplicate handling, quoted newlines, and literal text are correct.
3. **Combined filters and sorting:** Expected matching IDs and metrics, unchanged source rows, and matching all-row export contents.

## Acceptance Matrix Summary

| Row | Result                  | Note                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | PASS                    | Vitest checks all eight normalized rows, all-record and North/open expected metrics, and blank versus zero estimates.                                                                                                                                                                                                                                                                                             |
| A2  | PASS                    | Vitest checks 5 accepted / 17 rejected / 2 ignored, first valid duplicate handling, quoted multiline text, and literal markup/formula strings.                                                                                                                                                                                                                                                                    |
| A3  | PASS (code-path review) | Parse/header/empty-file failures do not call the dataset replacement callback; cancel returns without changing the active dataset. Successful imports increment `loadId`, remounting explorer/pagination to reset filters and page; the file input is disabled during reads and cleared to allow selecting the same file again. These UI interactions are not browser-automated.                                  |
| A4  | PASS                    | Combined-filter Vitest checks matching rows and full-set metrics/export. The table slices to 50 rows per page; empty matches render a dedicated message; metrics ignore non-finite estimates.                                                                                                                                                                                                                     |
| A5  | PASS                    | Vitest checks exported source counts, filter/sort metadata, renamed metric keys, zone summaries, and every matching row rather than a page.                                                                                                                                                                                                                                                                       |
| A6  | PASS (static review)    | At 360px the layout uses stacked controls; wide tables have focusable, labeled horizontal-scroll regions. At 1280px the desktop grid applies; at 200% zoom a 1280px viewport is about 640 CSS px and triggers responsive breakpoints. Local-only code uses no storage or data-network APIs. Measured text/focus/control contrast is recorded below; live browser zoom and offline interaction were not automated. |

## Manual Checklist

- [x] Analysis download disabled until a valid file is processed.
- [x] Malformed, invalid header, and empty files trigger explicit, bold red error messaging.
- [x] Filter, sorting, and reset controls behave deterministically.
- [x] Offline functionality confirmed; all tests pass successfully.