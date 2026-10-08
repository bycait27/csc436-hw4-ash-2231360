# AI Critique - CORS

- **Tool:** Gemini

- **Prompt:** My local frontend at `http://localhost:5174` cannot read my API at `http://localhost:3002`. DevTools shows the preflight response is missing `Access-Control-Allow-Origin`. What is the quickest fix?

- **Suggestion:** Install the `cors` package and add `app.use(cors())` before your routes. Restart your backend server, and the browser preflight request (`OPTIONS`) will now include the required `Access-Control-Allow-Origin` header, allowing `http://localhost:5174` to successfully communicate with it. 

- **What it actually does:** With the `cors` package’s default settings, `app.use(cors())` sends `Access-Control-Allow-Origin: *`. That lets any website origin read responses that don’t require credentialed access. CORS is not authentication or authorization.

- **The real cause:** [evidence/04-cors-preflights.txt](/evidence/04-cors-preflights.txt) shows that the API allowed `http://localhost:5173` but returned no `Access-Control-Allow-Origin` for `http://localhost:5174`. I found that the frontend was actually running at `http://localhost:5173`; `5174` was the wrong origin.

- **The real fix:** To fix the issue, I set the backend's `CORS_ORIGINS` to `localhost:5173` and restarted the server. The screenshots under `evidence/05-cors-break-fix/` show the failure and the successful preflight and request after the origin was corrected.

