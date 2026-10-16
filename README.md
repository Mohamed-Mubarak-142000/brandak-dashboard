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
- **Ground and ink:** a limestone ground with deep ink text.
- **Stamp blue (`--stamp`):** the only accent color, used for the primary action, focus, and the verification stamp.
- **Typography:** Reem Kufi for headings and the stamp, IBM Plex Sans Arabic for everything else.
- **Numbers:** Latin digits everywhere, so they match the InstaPay receipt.
- **CSS:** only logical properties (`ms-/me-/start/end`) are used.

## Pages

- **Payment review** `/payments`: the review queue (oldest first), the receipt from a short-lived signed link, a verification checklist that must be completed before approving, and rejection with a reason.
  - Keyboard shortcuts: `J/K` to move through the queue, `A` to approve, `R` to reject, `Z` to zoom.
- The remaining pages appear in the nav rail marked "قريبًا" (coming soon) until they're built.
