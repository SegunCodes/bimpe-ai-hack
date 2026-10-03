# Bimpe admin dashboard (frontend)

React + TypeScript + Vite + Tailwind. It talks to the backend over the REST API and polls every 3 seconds.

## Run it

You need Node.js 20 or newer (`node -v` to check).

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173. The public signup page is at http://localhost:5173/join.

If the backend runs somewhere other than `http://localhost:3001/api`, edit `VITE_API_URL` in `.env` and restart `npm run dev`.

Production build: `npm run build` (output goes to `dist/`).

> The backend must allow CORS from the frontend origin (e.g. `http://localhost:5173`).

## Files

```
frontend/
├── .env.example            API URL setting
├── index.html
├── vite.config.ts
└── src/
    ├── main.tsx            entry point
    ├── App.tsx             routes: /, /customers, /calls, /join
    ├── index.css           Tailwind + accent color + animations
    ├── lib/
    │   ├── api.ts          every API call (matches the contract)
    │   ├── types.ts        Customer, Order, Call types
    │   ├── phone.ts        E.164 conversion + pretty formatting
    │   ├── format.ts       dates, durations, languages
    │   ├── csv.ts          CSV parser + sample file
    │   └── transcript.ts   splits transcripts into agent/customer bubbles
    ├── hooks/
    │   ├── usePolling.ts   fetch every 3s, no flicker, keeps last data on error
    │   ├── useChangedIds.ts  detects new/changed rows for the highlight flash
    │   └── useHealth.ts    /health check (Demo mode pill, Offline banner)
    ├── components/         Layout, StatusBadge, Toast, Button, Modal/Drawer,
    │                       LiveFeed, CallCard, Transcript, States, Icons
    └── pages/
        ├── OrdersPage.tsx, OrderDrawer.tsx, AddOrderModal.tsx, ImportCsvModal.tsx
        ├── CustomersPage.tsx, CustomerDrawer.tsx, AddCustomerModal.tsx
        ├── LiveCallsPage.tsx
        └── JoinPage.tsx
```

## Demo checklist

Start the backend first, then `npm run dev`.

1. **Header**: the green "Live" pill shows. If the backend has `mockMode: true`, a yellow "Demo mode" pill shows too.
2. **Backend down**: stop the backend. Within ~10s a red banner appears and the pill turns "Offline". Start it again and the page recovers by itself.
3. **Orders, Add order**: click "Add order", pick "New customer", enter a name, phone `0803 123 4567`, item, seller and address, then submit. A green toast appears and the row shows up.
4. **Orders, Import CSV**: click "Import CSV", then "Download a sample". Upload that file. The preview shows 2 ready rows; click Import. The rows appear and new customers show up in the Customers tab.
5. **Call one order**: click "Call" on a row. A toast says "Calling …", the row pulses blue, and the button shows "Calling" and is disabled. When the backend updates the status, the row flashes yellow and the badge changes color.
6. **Call all pending**: click it. The toast says "Started N calls" and every pending row starts pulsing.
7. **Order detail**: click any row. The drawer shows the address on file next to the cleaned address, plus landmark, latest outcome, reschedule time, notes and attempts. Call history shows the transcript as chat bubbles, and an audio player if a recording exists. Press Esc or × to close.
8. **Customers**: the table shows name, phone, language and status. Click "Start onboarding call": you get a toast and the row shows "On a call". Click a row to see the profile (address, landmark, language, best time, consent) and call history.
9. **Live Calls tab**: new calls slide in at the top. Click a call to read its transcript. On wide screens the Orders tab also shows a compact live feed on the right.
10. **/join** (try it on your phone, or narrow the browser): enter a number and tap "Call me". You'll see "Your phone should ring in a few seconds." and a new onboarding call appears in Live Calls.

Status colors: pending gray · calling blue (animated) · confirmed green · rescheduled amber · address_updated purple · no_answer orange · failed red. For customers: new gray · called blue · verified green · no_answer orange.
