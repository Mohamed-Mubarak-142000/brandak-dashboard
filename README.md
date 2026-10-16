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

- **Payments** `/payments`: a TanStack Table (v9).
  - The status filter covers every status, with counts: under review, awaiting receipt, rejected, approved, cancelled, all.
  - Quick search by brand name or reference, sorting, and paging. The filter, page and sort live in the URL.
  - Every row has a "view details / review" action, plus a menu: open the receipt, copy the reference, reject with a reason.
- **Payment review** `/payments/[id]`: the receipt from a short-lived signed link, a verification checklist before approving, rejection with a reason, and the verification stamp.
  - After each decision, the next waiting receipt opens.
  - Keyboard shortcuts: `A` to approve, `R` to reject, `Z` to zoom.
- The remaining pages appear in the nav rail marked "قريبًا" (coming soon) until they're built.

## Deploy on Vercel

1. Import the `brandak-dashboard` repo into Vercel. The Framework Preset is detected automatically as **Next.js**.
2. Add one environment variable: `API_BASE_URL=https://brandak-backend.vercel.app/api/v1`.
3. Click Deploy.

The dashboard calls the API from the server (the BFF), so the API doesn't need `CORS_ORIGINS` for the dashboard. Session cookies are `Secure` in production, so open the dashboard over HTTPS only, which Vercel does by default.
