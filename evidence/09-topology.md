# Deployment Topology

- **Frontend origin (Render Static Site):** https://evidence-before-action-frontend.onrender.com
- **API origin (Render Web Service):** https://evidence-before-action-api.onrender.com

The frontend and API use different origins, so browser requests from the frontend to the API are subject to CORS. The API allows the exact production frontend origin using `CORS_ORIGINS`; requests from other browser origins cannot read the API response. The API remains directly reachable by non-browser clients, so CORS is not an authorization mechanism.

## Production Configuration

**Backend Web Service**

```text
CORS_ORIGINS=https://evidence-before-action-frontend.onrender.com
ALLOW_WRITES=false
```

**Frontend Static Site**

```text
VITE_API_URL=https://evidence-before-action-api.onrender.com/api
```

Both origins use HTTPS. If the HTTPS frontend were built with an `http://` API URL, the browser would block the request as mixed content before CORS is checked. DevTools would report a mixed-content error and the API request would not complete; changing the CORS allowlist would not fix it.
