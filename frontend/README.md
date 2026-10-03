# Bimpe admin dashboard (frontend)

Next.js (App Router) + TypeScript + Tailwind CSS + Motion. It talks to the backend over the REST API and polls every 3 seconds.

## Run it

You need Node.js 20 or newer (`node -v` to check). Run every command **inside the `frontend` folder**.

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000. The public signup page is at http://localhost:3000/join.

If the backend runs somewhere other than `http://localhost:3001/api`, edit `NEXT_PUBLIC_API_URL` in `.env` and restart `npm run dev`.

Production: `npm run build`, then `npm start`.

> The backend must allow CORS from the frontend origin: `http://localhost:3000`.

## Files

```
frontend/
├── .env.example              NEXT_PUBLIC_API_URL
├── next.config.ts
├── postcss.config.mjs        Tailwind
└── src/
    ├── app/                  Next.js routes
    │   ├── layout.tsx        fonts, metadata, providers
    │   ├── providers.tsx     toasts + Motion (respects "reduce motion")
    │   ├── globals.css       colors, easing tokens, button styles
    │   ├── (dashboard)/      header + tabs wrap these:
    │   │   ├── page.tsx      /          Orders
    │   │   ├── customers/    /customers
    │   │   └── calls/        /calls     Live calls
    │   └── join/page.tsx     /join      public signup (no dashboard chrome)
    ├── screens/              the page contents (Orders, Customers, Live calls, Join, modals, drawers)
    ├── components/           Layout, Button, Modal/Drawer/Segmented, Toast, LiveFeed, CallCard, StatusBadge…
    ├── hooks/                usePolling, useChangedIds, useHealth
    └── lib/                  api, types, phone, schedule (Lagos time), csv, transcript, format
```

## Motion

The animations are deliberate and small:

- **Buttons**: they press in slightly (scale 0.97, 160ms). Hover changes color only, and only on devices with a mouse.
- **Modals** fade and scale in from 96% (250ms). **Drawers** slide in from the right (450ms) and slide back out the same way.
- **Toasts** rise from the bottom and leave the same way. Click a toast to dismiss it.
- **Tabs and toggles**: the highlight slides to the selected tab.
- **Live feed**: a new call slides in at the top and the list glides down to make room.
- **Orders table**: new rows fade in, changed rows flash yellow, and rows on a live call pulse blue. Rows don't slide around while people read them.
- **/join**: the content staggers in, and on success the phone icon rings.
- Everything respects the operating system's "Reduce motion" setting.

## How it works

The business owner only adds orders (by hand or by CSV). For each order they pick a delivery date and time slot, and when the AI should call (default: 2 hours before delivery). The **backend** calls automatically at that time and retries up to 3 times, 30 minutes apart, if nobody answers. See [`../docs/BACKEND_SCHEDULING.md`](../docs/BACKEND_SCHEDULING.md) for the backend part. All times are Lagos time.

## Demo checklist

Start the backend first, then `npm run dev` inside `frontend`.

1. **Header**: the green "Live" pill shows. If the backend has `mockMode: true`, a yellow "Demo mode" pill shows too.
2. **Backend down**: stop the backend. Within ~10s a red banner appears and the pill turns "Offline". Start it again and the page recovers by itself.
3. **Add order**: click "Add order", pick a customer (or "New customer" with phone `0803 123 4567`), and enter the item, seller and address. Pick a delivery date and a time slot, then "When should the AI call?". The blue box shows exactly when the AI will call. Click "Schedule order". The toast repeats the call time, and the row shows **Scheduled** with the call time and a countdown.
4. **Automatic call (the demo moment)**: add an order with "When should the AI call?" set to **Right away**. Within a minute the row turns **Calling** (pulsing blue) with nobody clicking anything, and the call slides into the live panel.
5. **No answer**: if the customer doesn't pick up, the row goes back to **Scheduled** with "No answer, retry 2 of 3" in orange. After 3 misses it shows **No answer** and counts under "Need your attention".
6. **Import CSV**: click "Import CSV", then "Download a sample", and upload it. Choose "When should the AI call?" once for the whole file. The preview shows each order's delivery and call time. Click "Schedule".
7. **Order detail**: click a row. The purple box shows the next call time and the rule. "Call now instead" is the manual backup. Below that: original vs cleaned address, outcome fields, and call history with transcript and recording.
8. **Customers**: "Start onboarding call" still works manually. Click a row to see the profile and call history.
9. **Live Calls tab**: new calls slide in at the top. Click one to read its transcript.
10. **/join** on a phone: enter a number, tap "Call me", and you see "Your phone should ring in a few seconds."

Status colors: pending gray · scheduled indigo · calling blue (animated) · confirmed green · rescheduled amber · address_updated purple · no_answer orange · failed red. For customers: new gray · called blue · verified green · no_answer orange.
