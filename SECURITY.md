# Security

If you find a vulnerability, please don't open a public issue. Email me at kimaswaemma36@gmail.com with the details.

I aim to respond within a couple of days. If the issue is confirmed, I'll work on a fix and credit you in the release notes if you'd like to be named.

## In scope

- Anything that lets one user read another user's media or chat without permission.
- Anything that lets a non-host bypass the waiting room.
- Anything that lets you crash the server or hold a room hostage.
- Server-side amplification or rate-limit bypass.

## Not in scope

- Findings that require the attacker to already be on the same call as the victim.
- Findings against third-party dependencies. File those upstream.
- Findings that rely on the host willingly trusting an attacker (e.g. they invited them in).
- Self-XSS or attacks that require the user to paste content into the devtools console.
