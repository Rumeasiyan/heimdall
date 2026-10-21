# HEIMDALL Public Map and Archive

This folder is a fixture-backed front-end prototype for [Issue #16](https://github.com/Rumeasiyan/heimdall/issues/16). It contains only the public map/archive surface; the admin console belongs to Issue #4 and is intentionally excluded.

The prototype demonstrates:

- Public office status, coverage, and recent connectivity metrics.
- An office archive with shareable office and date-range URLs.
- Per-computer rows only for offices with at least three enrolled and reporting computers.
- Dated enrolment events without workstation descriptions.
- Throughput, latency, jitter, packet loss, and uptime shown as median, p10, and p90 values; silent offices do not publish fabricated performance metrics.
- CSV and JSON downloads from public fixtures.

All readings are synthetic development fixtures, not live measurements. Fixture labels are illustrative only; production anonymised labels must be assigned by the server using a stable, non-install-order mapping. The static prototype cannot provide a production privacy boundary or prove that fixture values are live.

The selected production architecture is an Axum application serving HTMX and MiniJinja templates. This static prototype is for parallel UI work against fixtures and does not implement the backend read API, server-rendered templates, or production data-signing/proof mechanisms. It has no admin login or write operations.

## Run locally

```powershell
npm install
npm run dev
```

Open `http://localhost:5173/`.

## Verify

```powershell
npm test
```
