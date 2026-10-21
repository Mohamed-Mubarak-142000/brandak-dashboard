# Brandak Dashboard

The Super Admin operations desk for Brandak. Arabic, RTL, built with Next.js 16 (App Router) + Tailwind v4 + Radix primitives.

## Run locally

```bash
npm install
cp .env.example .env.local   # API_BASE_URL → the Brandak API
npm run dev -- -p 3001
```

## How auth works

The browser never holds a token.
- `app/api/auth/login` logs in against the API and accepts **SUPER_ADMIN** accounts only. The tokens are stored in httpOnly cookies.
- `app/api/proxy/[...path]` forwards every API call with the token attached. When the token expires, it refreshes it once automatically.
- `proxy.ts` sends visitors without a session to `/login`.
- Since every call goes through the same origin, the API doesn't need CORS.

## Design system

The tokens are in `app/globals.css`, with light and dark modes.
- **Brand orange `--brand` (#F16B21):** the exact logo color, used for the logo, the stamp ring and the large marks.
- **Accent `--accent` (#C2500F):** the same orange, darkened so white text on it passes AA contrast. Used for buttons, links and focus.
- **Ground and ink:** a neutral stone ground with warm ink text, so the orange is the only color that stands out.
- **Typography:** Reem Kufi for headings and the stamp, IBM Plex Sans Arabic for everything else.
- **Numbers:** Latin digits everywhere, so they match the InstaPay receipt.
- **CSS:** only logical properties (`ms-/me-/start/end`) are used.
- **Logo assets:** `public/brand/` (logo and mark on transparent backgrounds) and `app/icon.png` / `app/apple-icon.png`.

## Pages

Every list page uses the same components (`components/data/`): a TanStack Table (v9) on desktop and a list on phones, a filter dialog with removable chips, search, paging, and the loading, empty and error states. Filters live in the URL.

| Page | What it does |
|---|---|
| `/` Overview | What's waiting for a decision (receipts, brand applications, reports), MRR and collections, active subscriptions by plan, and brand counts. |
| `/payments` + `/payments/[id]` | Reviewing InstaPay receipts: a verification checklist, the stamp, and rejection with a reason. |
| `/brands` + `/brands/[id]` | Approve, reject, suspend and reinstate. The detail page shows shipping, subscriptions, payments and the brand's activity log. |
| `/orders` + `/orders/[id]` | Search by order number or phone, filter by status and date range, the order timeline, and admin cancellation with a reason. |
| `/support` + `/support/[id]` | Support tickets and buyer-protection cases: counts by status (escalated first), the conversation with photos, admin replies, and the decision (for the customer on a protection case adds a strike to the store; 3 suspend it). |
| `/returns` | Every return request with its items, photos and timeline. Admins can overturn a store's rejection or move a stuck return along. |
| `/ads` | Reviewing paid placements against their InstaPay receipt, CTR of running ads, and the weekly price of each placement. |
| `/reports` | Close a report after taking action, dismiss it, hide or show a review, take a product down. |
| `/users` | Search, suspend and reinstate. Suspending signs the user out of every device. |
| `/audit` | The read-only log of every sensitive action, filterable by element type. |
| `/settings` | Subscription plans and categories, with create, edit, activate and deactivate. |
| `/account` | Account details and changing the password. |

## Deploy on Vercel

1. Import the `brandak-dashboard` repo into Vercel. The Framework Preset is detected automatically as **Next.js**.
2. Add one environment variable: `API_BASE_URL=https://brandak-backend.vercel.app/api/v1`.
3. Click Deploy.

The dashboard calls the API from the server (the BFF), so the API doesn't need `CORS_ORIGINS` for the dashboard. Session cookies are `Secure` in production, so open the dashboard over HTTPS only, which Vercel does by default.
