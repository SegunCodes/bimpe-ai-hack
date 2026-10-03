# Tellero call API

A TypeScript/Express backend for delivery and onboarding calls, placed through BimpeAI. It stores customers, orders, and calls in **Postgres (Neon)** and is built to run on **Vercel**. Set `MOCK_CALLS=true` to demo without contacting a phone.

## How it runs

- `src/app.ts` is the Express app. Vercel deploys its default export as one serverless function.
- Serverless functions only run during a request, so all background work (starting scheduled calls, dialling queued calls, checking BimpeAI for finished calls, demo results) happens in one **tick**:
  - `GET /api/cron/tick` (secret required) runs it. A free external cron calls it every minute.
  - While the dashboard is open, its normal requests also start a tick at most every `TICK_MIN_GAP_MS`, so demos stay snappy.
  - Every step claims rows atomically, so overlapping ticks never double-dial or double-record.
- `src/local.ts` is for local development: a normal server plus a tick every `TICK_INTERVAL_MS`.
- Tables are created automatically on the first request (and demo data is seeded into an empty database; set `SEED_DEMO_DATA=false` to skip).

## Run locally

Prerequisites: Node.js 20+, and either Docker Desktop or a free Neon database.

1. In this folder, create your local environment file:

   ```sh
   cp .env.example .env
   ```

2. Database, pick one:
   - Docker: `docker compose up -d postgres` (matches the default `DATABASE_URL`), or
   - Neon: create a free project at neon.tech and paste its connection string into `DATABASE_URL`.

3. Install and run:

   ```sh
   npm install
   npm run dev
   ```

The API listens on `http://localhost:3001`.

## Deploy: Neon + Vercel + a free cron

**1. Neon (database)**
1. Create a project at [neon.tech](https://neon.tech) (region: pick the one closest to your Vercel region, e.g. Europe Frankfurt for Lagos traffic).
2. Click **Connect**, choose the **pooled** connection, and copy the connection string (it starts with `postgresql://` and its host contains `-pooler`).

**2. Vercel (API)**
1. New Project → import the GitHub repo → **Root Directory: `backend`**. Framework preset: Express (detected automatically).
2. Environment Variables:
   - `DATABASE_URL` = the Neon pooled connection string
   - `CRON_SECRET` = a long random value (e.g. from `openssl rand -hex 24`)
   - `MOCK_CALLS` = `true` for demos (`false` with the BimpeAI settings below for real calls)
   - BimpeAI: `BIMPE_API_KEY`, `BIMPE_DELIVERY_AGENT_ID`, `BIMPE_ONBOARDING_AGENT_ID`, `BIMPE_IS_TEST_CALL`, `WEBHOOK_SECRET`
3. Deploy, then open `https://<your-api>.vercel.app/`. This self-check shows `"database": "ok"` when everything is connected, or the *type* of problem (never the address or password). It also lists the names of any database settings it can see.
   - Created the database from Vercel's **Storage** tab? That works too: the backend finds `DATABASE_URL` / `POSTGRES_URL` even when Vercel adds a prefix (e.g. `STORAGE_URL_DATABASE_URL`), and prefers the pooled one.
4. Set `PUBLIC_BASE_URL` to that address and redeploy.

**3. Cron (every minute, free)**

Vercel's free plan only allows cron jobs once a day, so use a free external scheduler such as [cron-job.org](https://cron-job.org):
- URL: `https://<your-api>.vercel.app/api/cron/tick`
- Schedule: every minute
- Header: `Authorization: Bearer <your CRON_SECRET>` (or append `?key=<your CRON_SECRET>` to the URL if the service can't send headers)

On Vercel Pro you can use Vercel Cron instead: add `"crons": [{ "path": "/api/cron/tick", "schedule": "* * * * *" }]` to a `vercel.json` in this folder; Vercel sends the `CRON_SECRET` header automatically.

**4. Frontend**

In the frontend's Vercel project set `NEXT_PUBLIC_API_URL` = `https://<your-api>.vercel.app/api` and redeploy it.

## Scheduled calls

Orders can carry a call time. The dashboard sends these extra fields on `POST /api/orders` and `POST /api/orders/bulk`:

| field | example | meaning |
| --- | --- | --- |
| `delivery_at` | `2026-10-04T08:00:00.000Z` | start of the delivery slot (ISO 8601, UTC) |
| `call_at` | `2026-10-04T06:00:00.000Z` | when the AI should call |
| `call_plan` | `2h_before` | the rule the owner picked (display only) |

An order created with `call_at` gets status `scheduled`. Each tick finds scheduled orders whose `call_at` has passed, claims each one atomically (so nobody is called twice), and dials it. `call_at` in the past means "call on the next tick" (within about a minute in production, or a few seconds while the dashboard is open).

No answer: the order goes back to `scheduled` with `call_at` = now + `RETRY_DELAY_MINUTES` (default 30), until `MAX_CALL_ATTEMPTS` (default 3) calls have been made; after that it stays `no_answer`. Retries are stored in the database, so they survive a restart. A manual `POST /api/orders/:id/call` clears any pending scheduled time.

For a quick demo of retries, set `RETRY_DELAY_MINUTES=1` in `.env`.

Quick test (calls on the next tick in mock mode):

```sh
curl -X POST http://localhost:3001/api/orders -H 'Content-Type: application/json' -d "{\"customer_id\":1,\"item\":\"Phone case\",\"seller\":\"Lagos Gadgets\",\"address_on_file\":\"10 Admiralty Way, Lekki\",\"delivery_window\":\"Today 2pm-5pm\",\"call_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"call_plan\":\"now\"}"
```

## BimpeAI webhook

Install ngrok, then in another terminal run:

```sh
ngrok http 3001
```

Copy the HTTPS forwarding URL (for example `https://abc123.ngrok-free.app`) into `PUBLIC_BASE_URL`, then configure BimpeAI's call-end webhook URL as:

```text
https://abc123.ngrok-free.app/api/webhooks/bimpe
```

If BimpeAI is configured to post to the non-prefixed route, `/webhooks/bimpe` is also accepted. Set the same `WEBHOOK_SECRET` in this app and in BimpeAI only if BimpeAI supports a shared-secret header; this backend checks `x-webhook-secret` or `Authorization: Bearer ...` when configured. The documented endpoint/payload currently does not specify webhook settings, so verify the event name, payload fields, and signature/header format in BimpeAI.

## API smoke tests

Run these after `npm run dev`; each command prints the JSON response.

```sh
curl http://localhost:3001/health
curl http://localhost:3001/api/customers
curl -X POST http://localhost:3001/api/customers -H 'Content-Type: application/json' -d '{"name":"Test Customer","phone":"08031234599","language":"pcm"}'
curl -X POST http://localhost:3001/api/customers/1/call
curl http://localhost:3001/api/orders
curl -X POST http://localhost:3001/api/orders -H 'Content-Type: application/json' -d '{"customer_id":1,"item":"Phone case","seller":"Lagos Gadgets","address_on_file":"10 Admiralty Way, Lekki","delivery_window":"Tomorrow 2pm-5pm"}'
curl -X POST http://localhost:3001/api/orders/bulk -H 'Content-Type: application/json' -d '{"orders":[{"customer_id":1,"item":"Cable","seller":"Lagos Gadgets","address_on_file":"10 Admiralty Way, Lekki","delivery_window":"Tomorrow"}]}'
curl http://localhost:3001/api/orders/1
curl -X POST http://localhost:3001/api/orders/1/call
curl -X POST http://localhost:3001/api/orders/call-all-pending
curl http://localhost:3001/api/calls
curl http://localhost:3001/api/calls/1
curl -X POST http://localhost:3001/api/public/signup -H 'Content-Type: application/json' -d '{"name":"New Caller","phone":"08031234598"}'
curl -X POST http://localhost:3001/api/dev/simulate-call-result -H 'Content-Type: application/json' -d '{"callId":1,"outcome":"confirmed"}'
curl -X POST http://localhost:3001/api/webhooks/bimpe -H 'Content-Type: application/json' -d '{"data":{"call_id":"mock-call-id","status":"completed","transcript":"Customer confirmed","extracted":{"outcome":"confirmed"}}}'
curl 'http://localhost:3001/api/agent-context?phone=%2B2348031234501'
```

Call IDs in `/api/dev/simulate-call-result` are the local integer `calls.id` values. In mock mode, results arrive automatically after six seconds; you can also force a result before then.

## Notes and TODOs

- The documented BimpeAI start-call endpoint has no per-call context fields. The agent must call `/api/agent-context?phone=...` (or use `call_id`) at call start. Agent tool availability and prompt updates are not documented; prompt update and transcript extraction remain stubs.
- The webhook parser accepts common call ID/status/transcript fields defensively, but the actual event schema and signature mechanism must be verified. Unexpected payloads are logged and acknowledged with HTTP 200.
- Live calls are checked against BimpeAI's get-call endpoint on every tick until they end (15-minute limit).
- Delivery no-answer outcomes are retried by the scheduler (see above). Each call request to BimpeAI carries an `Idempotency-Key`, so a retried request can never ring a customer twice.
