# BimpeAI Lagos Call Platform

A TypeScript/Express backend for delivery and onboarding calls. It stores customers, orders, and calls in MySQL. Set `MOCK_CALLS=true` to demo without contacting a phone.

## Run locally

Prerequisites: Node.js 20+ and Docker Desktop.

1. In this folder, create your local environment file:

   ```sh
   cp .env.example .env
   ```

2. Start MySQL (leave this terminal running):

   ```sh
   docker compose up -d mysql
   ```

3. Install dependencies and run the app:

   ```sh
   npm install
   npm run dev
   ```

The API listens on `http://localhost:3001`. Tables and demo data are created on first boot. Seed data contains three customers and five orders.

For live BimpeAI calls, set `MOCK_CALLS=false`, `BIMPE_API_KEY`, and either both playbook agent IDs or `BIMPE_AGENT_ID`. Keep `BIMPE_IS_TEST_CALL=true` until test telephony is verified. Restart the app after editing `.env`.

## Scheduled calls

Orders can carry a call time. The dashboard sends these extra fields on `POST /api/orders` and `POST /api/orders/bulk`:

| field | example | meaning |
| --- | --- | --- |
| `delivery_at` | `2026-10-04T08:00:00.000Z` | start of the delivery slot (ISO 8601, UTC) |
| `call_at` | `2026-10-04T06:00:00.000Z` | when the AI should call |
| `call_plan` | `2h_before` | the rule the owner picked (display only) |

An order created with `call_at` gets status `scheduled`. Every `SCHEDULER_INTERVAL_MS` (default 15s) the scheduler finds scheduled orders whose `call_at` has passed, claims each one atomically (so nobody is called twice), and starts the call through the normal one-at-a-time queue. `call_at` in the past means "call on the next tick".

No answer: the order goes back to `scheduled` with `call_at` = now + `RETRY_DELAY_MINUTES` (default 30), until `MAX_CALL_ATTEMPTS` (default 3) calls have been made; after that it stays `no_answer`. Retries are stored in the database, so they survive a restart. A manual `POST /api/orders/:id/call` clears any pending scheduled time.

For a quick demo of retries, set `RETRY_DELAY_MINUTES=1` in `.env`.

Existing databases are upgraded automatically on start (the three columns, the `scheduled` status and an index are added if missing).

Quick test (calls about 15 seconds later in mock mode):

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
- Finished-call fetch/polling is a TODO until BimpeAI provides its endpoint and response docs. Until then, live calls require webhooks for completion.
- Delivery no-answer outcomes are retried by the scheduler (see below). The global queue starts one call at a time with a five-second minimum gap.
