# Backend change: scheduled AI calls

**Goal:** the business owner only enters orders. The backend calls each customer automatically at the time the owner picked, and retries if nobody answers. The dashboard no longer has per-row "Call" buttons. It only has a "Call now" backup inside the order detail.

The frontend works out the exact call time and sends it, so the backend only has to store it and act on it.

## 1. New columns on `orders`

| column        | type                  | meaning |
|---------------|-----------------------|---------|
| `delivery_at` | TEXT, ISO 8601 UTC    | Start of the delivery slot, e.g. `2026-10-04T08:00:00.000Z` (= 9:00 am Lagos) |
| `call_at`     | TEXT, ISO 8601 UTC, nullable | When the AI should call **next**. Set to `NULL` when no call is planned |
| `call_plan`   | TEXT                  | The rule the owner picked, for display only: `2h_before`, `1h_before`, `30m_before`, `morning_of`, `day_before`, `now` |

`delivery_window` stays. The frontend now fills it with readable text such as `"Sun 4 Oct, 9am – 12pm"`, which the AI can read out on the call.

Return all three new fields everywhere an order is returned (`GET /orders`, `GET /orders/:id`, the POST responses).

## 2. New order status: `scheduled`

Full list: `pending`, **`scheduled`**, `calling`, `confirmed`, `rescheduled`, `address_updated`, `no_answer`, `failed`.

- `POST /orders` and `POST /orders/bulk`: if `call_at` is present, save the order with `status = 'scheduled'`. Without it, use `pending` as before.

Request body (both endpoints, per order):

```json
{
  "customer_id": 1,
  "item": "Rice cooker",
  "seller": "Konga",
  "address_on_file": "5 Allen Avenue, Ikeja",
  "delivery_window": "Sun 4 Oct, 9am – 12pm",
  "delivery_at": "2026-10-04T08:00:00.000Z",
  "call_at": "2026-10-04T07:00:00.000Z",
  "call_plan": "1h_before"
}
```

`call_at` may already be in the past (for example "right away", or a delivery that's very soon). In that case, call on the next scheduler tick.

## 3. The scheduler (the important part)

Run a timer every **30–60 seconds** inside the backend process (`setInterval`, or `node-cron` if you prefer):

```
every 30s:
  due = SELECT * FROM orders
        WHERE status = 'scheduled'
          AND call_at IS NOT NULL
          AND call_at <= now()
  for each order in due:
     start the delivery call, exactly what POST /orders/:id/call does today:
       - status   = 'calling'
       - attempts = attempts + 1
       - call_at  = NULL        <- so it is not picked up twice
```

Compare times as real dates. If you compare strings, make sure both sides are ISO UTC: `new Date().toISOString()`.

To avoid double calls if a tick runs long, claim the row atomically, e.g.
`UPDATE orders SET status='calling', call_at=NULL WHERE id=? AND status='scheduled'` and only call if 1 row changed.

## 4. Automatic retry on no answer

When a delivery call ends (your webhook / end-of-call handler):

```
MAX_ATTEMPTS = 3
RETRY_MINUTES = 30

if outcome is no answer / busy / voicemail:
    if order.attempts < MAX_ATTEMPTS:
        status  = 'scheduled'
        call_at = now + 30 minutes
        outcome_notes = 'No answer, retrying at <time>'
    else:
        status  = 'no_answer'      <- shows red "Needs your attention" in the dashboard
        call_at = NULL
else:
    set status from the outcome as today (confirmed / rescheduled / address_updated / failed)
    call_at = NULL
```

The dashboard displays "No answer, retry 2 of 3" from `attempts` while `status = 'scheduled'`, so keep `MAX_ATTEMPTS = 3` (or tell the frontend if it changes; it's `MAX_ATTEMPTS` in `frontend/src/lib/schedule.ts`).

**If the customer reschedules on the call**, set `status = 'rescheduled'` and `reschedule_time`. Optionally also set a new `delivery_at`. Don't schedule another call unless you want the AI to call again before the new time.

## 5. Manual "Call now" (unchanged endpoint)

`POST /orders/:id/call` keeps working. If the order was `scheduled`, set `call_at = NULL` when the call starts, so the scheduler doesn't call again later.

`POST /orders/call-all-pending` is no longer used by the dashboard. Keep it or remove it.

## 6. Timezone

All `delivery_at` / `call_at` values are UTC ISO strings. The owner picks times in **Lagos time (WAT, UTC+1)** and the frontend converts them. The backend should never need timezone math, beyond formatting a time for the AI to say aloud (use `Africa/Lagos`).

## Quick test

1. Create an order with `call_at` 1 minute from now → status `scheduled`.
2. Within ~1 minute it flips to `calling` by itself and `attempts` becomes 1.
3. Don't answer → after the call ends, status is `scheduled` again with `call_at` ≈ 30 min later.
4. After the 3rd unanswered call → status `no_answer`, `call_at` NULL.
