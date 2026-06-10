# chattr — web client

The SvelteKit front end for chattr: the lobby, room UI, tiles, chat, and the
mediasoup signaling client. For architecture, the SFU, and deployment, see the
[root README](../README.md).

## Setup

```bash
npm install
cp .env.example .env   # then fill in the values below
```

Environment variables (see `.env.example` for the full list):

- `VITE_SERVER_URL` — URL of the chattr server (e.g. `http://localhost:3000` in dev, `https://your-domain.com` in prod).
- `VITE_FIREBASE_*` — Firebase web config for Google sign-in.
- `VITE_TURN_URL` / `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL` — optional TURN server for UDP-blocked clients.

## Develop

```bash
npm run dev            # start the dev server
npm run dev -- --open  # and open a browser tab
```

## Build

```bash
npm run build          # production build into build/
npm run preview        # preview the production build locally
```

The build output is static — host it anywhere (Vercel, Netlify, Cloudflare
Pages, S3, or the same VPS as the server).

## Checks and tests

```bash
npm run check          # svelte-check type checking
npm run lint           # prettier + eslint
npm run test:unit      # vitest unit tests
npm run test:integration  # playwright e2e (drives two browser contexts through a room)
```
