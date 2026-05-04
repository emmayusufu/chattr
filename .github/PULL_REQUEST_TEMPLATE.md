## What this changes

A sentence or two on what's different after this PR lands.

## Why

What problem does it solve, or what was the motivation. Skip this for trivial fixes.

## How I tested it

What you actually did to convince yourself this works. Not what tests exist in CI; what you ran locally.

## Notes for the reviewer

Anything I should know before reading the diff: a tricky part, a deliberate non-obvious choice, a known follow-up.

---

Checks before opening:

- [ ] Lint and tests pass locally (`npm run lint` and `npm test` in the project I touched)
- [ ] If touching the room flow, opened it in two browser windows and confirmed host approval still works
- [ ] If touching media, verified mute, camera off, and screen share still release the OS indicators
- [ ] If touching UI, checked it on a phone-sized window
- [ ] No commented-out code, no `console.log`, no debug prints
