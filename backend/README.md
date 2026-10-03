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

The API listens on `http://localhost:3000`. Tables and demo data are created on first boot. Seed data contains three customers and five orders.

For live BimpeAI calls, set `MOCK_CALLS=false`, `BIMPE_API_KEY`, and either both playbook agent IDs or `BIMPE_AGENT_ID`. Keep `BIMPE_IS_TEST_CALL=true` until test telephony is verified. Restart the app after editing `.env`.

## BimpeAI webhook

Install ngrok, then in another terminal run:

```sh
ngrok http 3000
```

Copy the HTTPS forwarding URL (for example `https://abc123.ngrok-free.app`) into `PUBLIC_BASE_URL`, then configure BimpeAI's call-end webhook URL as:

```text
https://abc123.ngrok-free.app/api/webhooks/bimpe
```

If BimpeAI is configured to post to the non-prefixed route, `/webhooks/bimpe` is also accepted. Set the same `WEBHOOK_SECRET` in this app and in BimpeAI only if BimpeAI supports a shared-secret header; this backend checks `x-webhook-secret` or `Authorization: Bearer ...` when configured. The documented endpoint/payload currently does not specify webhook settings, so verify the event name, payload fields, and signature/header format in BimpeAI.

## API smoke tests

Run these after `npm run dev`; each command prints the JSON response.

```sh
curl http://localhost:3000/health
curl http://localhost:3000/api/customers
curl -X POST http://localhost:3000/api/customers -H 'Content-Type: application/json' -d '{"name":"Test Customer","phone":"08031234599","language":"pcm"}'
curl -X POST http://localhost:3000/api/customers/1/call
curl http://localhost:3000/api/orders
curl -X POST http://localhost:3000/api/orders -H 'Content-Type: application/json' -d '{"customer_id":1,"item":"Phone case","seller":"Lagos Gadgets","address_on_file":"10 Admiralty Way, Lekki","delivery_window":"Tomorrow 2pm-5pm"}'
curl -X POST http://localhost:3000/api/orders/bulk -H 'Content-Type: application/json' -d '{"orders":[{"customer_id":1,"item":"Cable","seller":"Lagos Gadgets","address_on_file":"10 Admiralty Way, Lekki","delivery_window":"Tomorrow"}]}'
curl http://localhost:3000/api/orders/1
curl -X POST http://localhost:3000/api/orders/1/call
curl -X POST http://localhost:3000/api/orders/call-all-pending
curl http://localhost:3000/api/calls
curl http://localhost:3000/api/calls/1
curl -X POST http://localhost:3000/api/public/signup -H 'Content-Type: application/json' -d '{"name":"New Caller","phone":"08031234598"}'
curl -X POST http://localhost:3000/api/dev/simulate-call-result -H 'Content-Type: application/json' -d '{"callId":1,"outcome":"confirmed"}'
curl -X POST http://localhost:3000/api/webhooks/bimpe -H 'Content-Type: application/json' -d '{"data":{"call_id":"mock-call-id","status":"completed","transcript":"Customer confirmed","extracted":{"outcome":"confirmed"}}}'
curl 'http://localhost:3000/api/agent-context?phone=%2B2348031234501'
```

Call IDs in `/api/dev/simulate-call-result` are the local integer `calls.id` values. In mock mode, results arrive automatically after six seconds; you can also force a result before then.

## Notes and TODOs

- The documented BimpeAI start-call endpoint has no per-call context fields. The agent must call `/api/agent-context?phone=...` (or use `call_id`) at call start. Agent tool availability and prompt updates are not documented; prompt update and transcript extraction remain stubs.
- The webhook parser accepts common call ID/status/transcript fields defensively, but the actual event schema and signature mechanism must be verified. Unexpected payloads are logged and acknowledged with HTTP 200.
- Finished-call fetch/polling is a TODO until BimpeAI provides its endpoint and response docs. Until then, live calls require webhooks for completion.
- Delivery no-answer outcomes automatically enqueue one retry after 60 seconds. The global queue starts one call at a time with a five-second minimum gap.
