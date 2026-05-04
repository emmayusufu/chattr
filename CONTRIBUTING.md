# Contributing

Thanks for poking around. If you want to send a fix or an idea, here's how I work with this code so things stay readable.

## Before you start

If it's a small fix, just open a PR. If it's something bigger, like a new feature or a behavior change, open an issue first so we can talk it through. I'd rather agree on the shape early than have you spend an evening on something I won't merge.

## Running it locally

You need Node 18 or later. Install dependencies in both `server/` and `client/`, copy the env example files, then run `npm run dev` in each.

If something doesn't work the first time, check that:

- Firebase config is filled in on the client side (`client/.env`).
- The server is reachable from your other browser tab. If you're testing across two devices on the same Wi-Fi, set `MEDIASOUP_ANNOUNCED_IP` to your LAN IP.

## Tests

Three places to look:

- `server/tests/unit/` runs under vitest. Pure logic plus chat handlers with a mocked socket.
- `client/src/lib/*.test.ts` runs under vitest too. Lightweight unit tests for client-side helpers.
- `client/tests/e2e/` runs under Playwright with two real browser contexts and a real server. These are the most useful when you change anything in the join flow.

Run unit tests with `npm test` in either project. Run the Playwright suite with `npm run test:integration` from `client/`. The Playwright config will start the server and client itself, but if they're already running it will reuse them.

## Style

Prettier and ESLint are set up in both projects. Run `npm run format` (server) or `npm run lint` (client) before sending a PR.

A few preferences I'll push back on in review:

- Comments that say what the code does. The code already does that. Comments are for the why.
- Mocking the database or fake-routing real signaling. If you're testing host approval, run the real flow.
- Renaming things to look fancier. If a name is fine, leave it alone.

## Commits

Short commit messages, present tense. "fix waiting room flash on invite link" reads better than "fixes a bug where the room briefly flashed". I don't enforce conventional commits, but I appreciate the effort to be specific.

## What's in scope

WebRTC pieces, the SFU, the room flow, chat, the lobby, host controls. Anything that makes a tutoring call go more smoothly is fair game.

What I'd push back on without a clear reason:

- Adding a database. Chat history is in memory by design.
- Server-side recording or transcripts.
- Pulling in a generic chat or video component library.
- Feature flags for things we don't have yet.

## Questions

Open an issue. I read them.
