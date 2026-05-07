# chattr

A multi-user video calling app built on top of a custom WebRTC SFU. Rooms, video, audio, screen share, end-to-end encrypted chat, host-approved waiting rooms, one-time invite links. [mediasoup](https://mediasoup.org) under the hood.

## What it does

- Multi-user calls with video, audio, screen share, and chat.
- Pre-join lobby with camera preview.
- Host approval flow ("waiting room"). First joiner is host. Everyone after that knocks, and the host approves or denies.
- One-time invite tokens that let trusted guests skip the lobby.
- Mute and camera-off that actually release the OS capture indicators, so there's no "still recording" mic dot when you're muted.
- Adaptive video quality via simulcast. Slow viewers get a lower spatial layer instead of frozen frames.
- Wi-Fi-blip recovery: socket reconnects, mediasoup state rebuilds, call resumes in a couple of seconds.
- End-to-end encrypted chat via URL fragment plus a per-message HKDF ratchet. The server only ever sees ciphertext.
- Capacity caps and per-socket rate limits on the server.
- Mobile-responsive layout.

## Stack

- **Server**: Node, TypeScript, Express, Socket.IO for signaling, mediasoup v3 as the SFU, pino for structured logging.
- **Client**: SvelteKit, mediasoup-client v3.20+, Firebase Auth (Google) for sign-in on the home page.

## Run it locally

You'll need Node 18+ and a Firebase project with Google sign-in turned on.

Create env files (defaults are fine for the server; the client's needs Firebase config filled in):

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Install everything and start both processes with one command:

```bash
npm run setup
npm run dev
```

`npm run dev` spawns the server (port 3000) and the client (port 3030) together with prefixed output. One Ctrl-C kills both.

Open `localhost:3030`, sign in or pick a name, click **New meeting**, and paste the URL into another browser. The server auto-detects your LAN IP so you can test across devices on the same Wi-Fi.

## Layout

```
server/
  src/
    handlers/         socket event handlers (chat, signaling, disconnect)
    mediasoup.ts      worker, codecs, transport options
    rooms.ts          in-memory room and user state
    rate-limit.ts     per-socket token bucket
    validate.ts       input validation
    config.ts         env-driven config
    logger.ts         pino
    index.ts          bootstrap
  tests/
    unit/             vitest, pure logic plus handlers with mocked socket
    load/             k6, signaling-only stress test
client/
  src/
    lib/
      RoomClient.ts   class wrapping mediasoup signaling, transports, ratchet, reconnect
      chat-crypto.ts  AES-GCM with per-message HKDF ratchet
      socket-utils.ts emitWithTimeout, withRetry helpers
      *.svelte        Lobby, RoomShell, Sidebar, Chat, People, Tile,
                      ControlBar, RoomTopBar, StatusCard, WaitingScreen
    routes/
      +page.svelte                 home
      [roomId]/+page.svelte        route page, phase routing only
    styles/
      tokens.css      design tokens
      base.css        reset, body, scrollbar, shared keyframes
    firebase.ts
deploy/
  Caddyfile           reverse proxy with HTTPS, HSTS, and a real CSP
docker-compose.yml    one-command prod stack (Caddy + server)
.github/              issue and PR templates
```

## Gotchas

**Tiles are keyed by user, not by producer.** The instinct is one tile per video producer. Don't do that. Camera toggle and screen share both close the old producer and create a new one with a different ID, so producer-keyed tiles flicker out and remount on every transition. Key tiles by `userId` instead. The participant is stable, the producer is just a stream they happen to be sending. When their producer goes away, set `videoStream = null` on the participant and let the tile show a name placeholder. Same tile, different content.

**Two send transports per peer, one per kind.** Producing both audio and video on a single transport sometimes generated SDP answers with conflicting RTP header extension IDs across the audio and video m-sections, and Chrome's `setRemoteDescription` refused with `RTP extension ID reassignment`. Splitting them puts each on its own PeerConnection with one m-section, so there's no cross-section to collide on.

**`producer.close()` doesn't actually close it.** Calling `close()` on a client-side mediasoup-client producer is local-only. The SFU keeps the server-side producer alive and keeps forwarding the last cached frame to every consumer. You need an explicit `close-producer` socket event that closes the server-side producer, which then propagates `producerclose` to consumers. This was the actual cause of "I stopped sharing but the other side sees a frozen screen for ten seconds."

## Testing

Server side: vitest unit tests for handlers and pure logic, plus a k6 signaling stress test that ramps to N×M concurrent socket clients and measures p50/p95/p99 join latency. The k6 run needs k6 installed locally and the server already running.

```bash
cd server
npm test
npm run load:signaling
```

Client side: vitest for helpers and a Playwright e2e suite that drives two real browser contexts through the room flow (lobby, host approval, admit).

```bash
cd client
npm run test:unit
npm run test:integration
```

## Deploy

1. **Get a host with a public IP.** A cheap VPS works. m7i-flex.large or similar.
2. **Open the firewall**: TCP 443 for HTTPS, plus a UDP range for mediasoup transports. Configure `rtcMinPort` and `rtcMaxPort` on the worker to tighten the range, then open exactly that.
3. **Server env vars** (see `server/.env.example` for the full list):
   ```
   MEDIASOUP_ANNOUNCED_IP=<your-public-IP>
   CLIENT_ORIGIN=https://chattr.jengahq.com
   ```
4. **Reverse proxy with TLS.** The included `deploy/Caddyfile` handles HTTPS via Let's Encrypt and adds HSTS, X-Frame-Options, a Permissions-Policy locking down to mic, cam, and display-capture only, and a real Content-Security-Policy. Domain and contact email are already set to `chattr.jengahq.com` and `kimaswaemma36@gmail.com`. Change those if you fork.
5. **Run it with Docker.** The repo includes a `docker-compose.yml` and a `server/Dockerfile`. From the box, run `docker compose up -d`. That brings up the server and Caddy together with auto-renew TLS. If you'd rather not use Docker, `npm run build && npm start` under pm2 or systemd works just as well.
6. **Client build**: set `VITE_SERVER_URL=https://chattr.jengahq.com` in the client's env, run `npm run build`, and deploy the `build/` output to any static host (Vercel, Netlify, Cloudflare Pages, S3, or the same VPS).

## Known limits

- No TURN. UDP-blocked clients fall back to TCP via mediasoup's `enableTcp`, which covers most networks. Add coturn if a real user can't connect.
- Chat history lives in server RAM. Restart wipes it.
- No reconnect for the host across full server restarts. If the server process dies mid-call, all clients drop and the room ends.
- Single Node process, single mediasoup worker. One CPU's worth of SFU.
- No recording, no transcripts, no breakout rooms. Out of scope.
