# CSC436 HW4 Write-up

**Frontend URL:** https://evidence-before-action-frontend.onrender.com

**API base URL:** https://evidence-before-action-api.onrender.com/api

---

**Name:** Caitlin Ash

**ID:** 2231360

**Commit SHA or Tag:** `hw4-submission`

**Platform/OS Version:** Windows 11 Pro, 64-bit

**Capture date:** 2026-10-08

**Redaction attestation:** I reviewed the submitted evidence and removed private credentials and unrelated personal information. Public Render hostnames and certificate details are retained because they are required evidence.

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