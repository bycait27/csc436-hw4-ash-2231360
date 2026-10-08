**Frontend URL:** https://evidence-before-action-frontend.onrender.com

**API base URL:** https://evidence-before-action-api.onrender.com/api

---

**Name:** Caitlin Ash

**ID:** 2231360

**Commit SHA or Tag:** `hw4-submission`

**Platform/OS Version:** Windows 11 Pro, 64-bit

**Capture date:** 2026-10-08

**Redaction attestation:** I reviewed the submitted evidence and removed private credentials and unrelated personal information. Public Render hostnames and certificate details are retained because they are required evidence.

---

# Evidence Before Action

![Screenshot of website](./assets/preview.png)

## Technology

- React 19 and TypeScript 6 for the client-side application
- Vite 8 for development and production builds
- Axios 1 for the configured frontend API client
- Express 5 for the Node.js ticket API
- Papa Parse for CSV parsing
- Vitest for automated tests
- ESLint for linting

## Requirements

- Node.js 24.x
- npm

## Setup and run

**Install dependencies from the repository root:**

```powershell
npm install
```

**Start the backend in a PowerShell terminal from the repository root.** Set the API port and the exact origin Vite will use before starting the server. These variables apply only to this terminal window; set them again in a new one.

```powershell
$env:PORT = "3002"
$env:CORS_ORIGINS = "http://localhost:5173"
npm run dev --workspace backend
```

If Vite prints a different port, such as `5174`, stop the backend with Ctrl+C, update `CORS_ORIGINS` to that exact origin, and restart it. To use the 8-ticket verification fixture instead of the default 240-ticket campus dataset, also set `$env:DATA_FILE = "..\data\verification.csv"` before starting the backend.

**Start the frontend in a second PowerShell terminal, also from the repository root:**

```powershell
$env:VITE_API_URL = "http://localhost:3002/api"
npm run dev --workspace frontend
```

Open the URL printed by Vite. If the API uses a different port, set `VITE_API_URL` to that API URL and restart Vite. Vite embeds this setting when it starts/builds. Choose **Local CSV mode** to use the original HW3 file-import workflow; **API mode** loads data from the backend.

## Tests

**Run all frontend and backend Vitest suites from the repository root:**

```powershell
npm test
```

To run a workspace by itself:

```powershell
npm test --workspace frontend
npm test --workspace backend
```

At the latest check, the frontend suite had 5 tests across 2 files and the backend suite had 13 tests across 2 files.

### Frontend tests

[`frontend/test/acceptance.test.ts`](frontend/test/acceptance.test.ts) contains the three HW3 acceptance tests. It uses the CSV fixtures below:

### A1 — `verification.csv`

**Fixture:** [`data/verification.csv`](data/verification.csv) (8 records). Checks that parsed field values are normalized strings, blank estimates remain unknown while `0` remains a known estimate, and independently expected metrics match:

| Filter | Matching | Open | Overdue open | Known open hours | Known open | Unknown open |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| All records | 8 | 6 | 3 | 14 | 4 | 2 |
| North, open | 2 | 2 | 1 | 4 | 1 | 1 |

### A2 — `edge-cases.csv`

**Fixture:** [`data/edge-cases.csv`](data/edge-cases.csv) (24 records, including blank records). Checks accepted/rejected/ignored counts (`5` / `17` / `2`), first-valid duplicate-ID handling, quoted commas and newlines, and literal summary text such as `<b>Inspect me</b>` and `=1+1`.

### Combined filters and sorting

Uses the same eight-row `verification.csv` fixture as A1. It combines an ID search with North/open filters, sorts newest-first, and checks matching IDs (`T-00002`, `T-00001`), metrics, unchanged source-row order, filter/sort metadata, zone summaries, and exported matching rows.

[`frontend/test/apiClient.test.ts`](frontend/test/apiClient.test.ts) tests the shared `ApiError` normalization: HTTP errors preserve status, server code/message, field details, and request ID; timeout, network, and canceled errors receive their distinct kinds.

### Backend tests

[`backend/test/ticketData.test.ts`](backend/test/ticketData.test.ts) tests loading validated CSV data, preserving blank estimates separately from zero, enforcing the ticket headers, and rejecting invalid records.

[`backend/test/api.test.ts`](backend/test/api.test.ts) tests the API contract, including the hand-checked summary metrics, validation and duplicate-ID errors, query filters/sorting/pagination, detail and CRUD routes, request IDs, health, read-only mode, and exact CORS behavior. The CORS tests cover allowed and disallowed preflights, an allowed-origin error response, and a disallowed-origin GET.

## AI-Use Log

### Task 1 — Ticket API

- **Tool:** GitHub Copilot
- **Query/Prompt Purpose:** Asked to be guided through HW4 Task 1 step by step, to implement the ticket API by reusing HW3 validation/metrics. Also asked for help interpreting the requirements and creating successful and failed API requests for evidence.
- **What was accepted:** Accepted the separate Express backend and the API scaffold for loading validated CSV data, in-memory tickets, list/summary/detail/create/PATCH/delete/health routes, request IDs, and consistent JSON errors. Used the provided PowerShell and `curl.exe` examples to make API requests and collect responses.
- **What was rejected/independently verified:** Did not treat a response from the unrelated port-3001 service as evidence for my API. Checked the server startup port and recaptured requests against my own API. Compared the `verification.csv` all-record and North/open summaries with the hand-calculated HW3 metrics, and checked HTTP status codes, error bodies, request IDs, `Location`, and API test output. Reported an empty-body POST that returned 500; the API was corrected to return a contract-shaped 400 and covered by a test.

### Task 2 — Exact CORS policy

- **Tool:** GitHub Copilot
- **Query/Prompt Purpose:** Supplied the assignment’s exact CORS requirements and asked for help implementing and proving them, including allowed/disallowed preflights, CORS on errors, exposed response headers, and `Vary: Origin`.
- **What was accepted:** Accepted a configured allowlist using exact origins, allowed preflights for the client methods and headers, a 600-second max age, exposed `Location` and `X-Request-Id`, and CORS middleware registered before routes. Followed instructions for collecting the curl and browser break/fix evidence.
- **What was rejected/independently verified:** Rejected early transcripts that showed `PUT` or omitted `Vary: Origin` as evidence for the updated policy. Confirmed the current server/port and recaptured. Verified the allowed origin returns `Access-Control-Allow-Origin`, while the disallowed origin does not, and both vary on `Origin`. Checked that a disallowed-origin `curl` GET can still return data because CORS restricts browser JavaScript access, not API authorization. Matched `CORS_ORIGINS` to the exact Vite origin, including its port.

### Task 3 — Axios client and API-driven UI

- **Tool:** GitHub Copilot
- **Query/Prompt Purpose:** Supplied Task 3 requirements and the class example, asking for a single configured Axios client, typed endpoint helpers, runtime response checks, shared API error classification, cancellation, API-backed screens, create/close actions, and an automated frontend error test.
- **What was accepted:** Accepted the shared Axios client and typed ticket endpoint module, API mode as the default, and the original HW3 local-CSV screen as an alternate mode. Accepted the create form, close-ticket action using the API reference date, field-level validation display, and the Vitest `ApiError` classification test.
- **What was rejected/independently verified:** Kept the Axios timeout at four seconds instead of masking a sleeping server with a very long timeout. Checked the frontend/backend tests, production build/typecheck, and lint. Independently verified the 8-ticket summary and CORS response, then exercised create and invalid create in the browser and inspected the returned `Location`, field reason, and request ID. I also observed the timeout and canceled-request behavior in DevTools.