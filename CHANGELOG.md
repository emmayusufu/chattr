# Changelog

All notable changes to chattr, newest first. Format follows
[Keep a Changelog](https://keepachangelog.com/); the project uses
[Semantic Versioning](https://semver.org/).

## Versioning

- **One version for the whole product** (root `package.json`). The client
  (SvelteKit), server (mediasoup/Node), and desktop (Tauri) deploy together
  from `main`, so they share a single product version rather than versioning
  independently.
- **Conventional Commits drive the bump**: `feat:` → minor, `fix:`/`perf:` →
  patch, a breaking change (`!` / `BREAKING CHANGE`) → major.
- **Releases are cut manually**: bump the root version, move `Unreleased` into
  a dated version section here, tag `vX.Y.Z` on `main`, and create a matching
  GitHub Release (CI auto-deploys on push to `main`).

## [Unreleased]

Target: **v0.3.0** (desktop app + poor-network audio). Not yet tagged.

### Added
- **Desktop app (Tauri 2 + Rust).** Wraps the SvelteKit client in a native
  window; Google sign-in routed through the system browser via
  `tauri-plugin-google-auth` (browser OAuth popups don't work in WKWebView).
- **CI/CD.** GitHub Actions auto-deploys to the GCP VM on push to `main`.
- **Participant mute indicators.** Mute state is broadcast over a `mute-state`
  socket event (server tracks it per user so late joiners are accurate) and
  shown as a mic-off badge on each tile, including your own.
- **Meet-style tile grid.** Three participants render 2-on-top + 1-centered;
  columns = `ceil(√n)`, last partial row auto-centers, tiles bounded so nothing
  overflows the viewport.
- **RNNoise noise suppression** (toggleable, fail-safe) on the mic before
  encoding, via a WASM AudioWorklet — works in both the browser and the Tauri
  WebView.
- **last-N + dominant-speaker.** A per-room `AudioLevelObserver` emits the
  dominant speaker; the client pauses server-side video forwarding for
  participants it isn't rendering and keeps active speakers in the visible set.
- **Adaptive video quality (simulcast layer by tile size).** Cameras shown in
  small tiles request a lower simulcast spatial layer from the SFU while large
  tiles get full resolution, so downlink bandwidth matches what's actually
  rendered — the largest bandwidth lever since video dwarfs audio.

- **Tile accessibility** — each video tile carries a `role` and an `aria-label`
  naming the participant and their mute/camera state.

### Changed
- **Opus tuned for voice on poor networks:** mono, DTX, in-band FEC, NACK, and
  a lower average-bitrate cap. Resilience also rides on mediasoup's existing
  loss-feedback FEC ramp.
- **Screen share capped** for poor networks: 15 fps, ≤1080p, `contentHint:
  'detail'`, and a 1.5 Mbps encoding ceiling instead of reusing camera params.
- **Bandwidth estimation seeded** (`initialAvailableOutgoingBitrate` 1 Mbps) so
  it ramps fast, plus a 5 Mbps incoming ceiling per sender as an abuse guard.
- **Fonts no longer render-block** — Fredoka loads via a preconnected `<link>`
  in `<head>` instead of a chained CSS `@import`.

### Security
- **Chat is members-only and the sender is server-derived** (no longer trusts a
  client-supplied name); chat history is capped at 200 messages per room.
- **Membership guards** on the transcript, transcription start/stop, and
  mute-state relays, with `roomId` validation.
- **Invite tokens expire** (24h) and are capped per room.
- Signaling handlers now **call back with an error** on early returns so the
  client fails fast instead of waiting out the 8s × 3 retry timeout.

### Fixed
- **Joining muted with the camera off no longer hides everyone else.** Consuming
  other participants' media used to happen only as a side effect of publishing
  your own, so a silent, camera-off joiner saw nobody. The client now asks the
  server for the current producer list (`get-producers`) right after it starts
  listening for new ones, independent of whether it publishes. Same path runs on
  reconnect, so a returning client re-syncs everyone.
- **Reconnect grace + stable identity.** Each client carries a stable
  `participantId` and a secret `sessionToken` across reconnects, so the server
  recognizes a returning socket instead of treating it as a new joiner. When a
  socket drops, the slot is held for a 30s grace window: a host's network blip
  no longer ends the call for everyone, and a guest who reconnects in time
  resumes in place rather than being sent back to the waiting room.
- **ICE restart recovery.** When a transport's media path fails (common on
  mobile as the network flaps), the client asks the SFU to restart ICE on that
  transport and applies the fresh parameters in place, recovering the call
  without rejoining or bouncing the participant back to the waiting room.
- **One shared receive transport per participant** instead of one per remote
  producer. Each consumer used to open its own WebRTC transport, so a busy room
  leaked transports; consumers now share a single recv transport that is closed
  on leave and rebuilt on reconnect.
- **TURN-ready ICE config.** ICE servers read optional TURN credentials from the
  environment, so a relay can be added for hard-NAT mobile networks without a
  code change (STUN-only by default).
- **Mobile audio autoplay** — remote audio now calls `play()` and, if the
  browser blocks it, shows a one-time "tap to enable audio" prompt.
- Removed a **redundant keyframe request** (the 800ms duplicate in `consume`)
  that caused an extra bandwidth spike per video consumer.
- AiChat composer no longer opens at an inflated height (resize now runs on
  input, not on mount during the panel-open animation).
- Secure-context guards for desktop/LAN: `crypto.subtle` and `getUserMedia`
  feature-checks, HTTPS scheme in the WebView, Safari handler for mediasoup in
  WKWebView, and localhost CORS origins.

## [0.2.0] - 2026-05-25

### Added
- **Markdown chat** — messages render with code blocks, lists, and links
  (marked + DOMPurify), with a multi-line composer (Shift+Enter for newline).
- **Meet-style screen share** — separate producer per kind, so camera and
  screen coexist; split layout with the screen as the stage and cameras in a
  side strip.
- **Waiting room redesign** — mic/cam toggles that work before admission,
  preview tile, and room-code badge.
- **Private AI chat** — a Gemini-backed sidebar tab that can see the largest
  shared video frame; key stored per-browser (BYOK).
- **Live meeting minutes** — host-controlled speech-to-text shared across
  participants, exportable as a text file.
- **UI overhaul** — glassy sidebar panel, transparent bottom control bar,
  rounded tiles with initials avatars, animated sidebar.

## [0.1.0] - 2026-05-07

### Added
- Multi-party video calling on a custom mediasoup SFU.
- Host-approved waiting room with invite links.
- End-to-end encrypted chat keyed off a URL-fragment secret.
- Dockerised deploy (server + client + Caddy) with a hardened CSP.
