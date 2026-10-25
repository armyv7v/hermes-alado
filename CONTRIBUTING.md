# Contributing to Alado

Thanks for wanting to help. Alado is a light, everyday Hermes client for your phone — every
contribution should respect that.

## The bar: light and everyday

Alado is deliberately the *opposite* of a desk app. The product principle that decides every
trade-off:

> **Light. Hermes for everyday life, not for sitting down to work.**

- Default screens show only what you use daily: chats, groups, approvals, notifications, voice,
  quick routines. Power/admin features go behind "Avanzado" or a detail screen — never in the
  primary flow.
- Prefer one tap and sensible defaults over options. No walls of settings, no raw technical text.
- If a feature mainly helps someone working at a desk, it belongs in Hermes Desktop, not here.
- Keep the PWA small and fast (lazy-load heavy, rarely used screens).

Before proposing a feature, check it against that bar. A PR that adds a desk-first feature will
likely be declined no matter how clean the code is.

## Setup

```bash
cd app
npm ci
npm run dev          # HERMES_URL=http://localhost:9119 npm run dev for a local Hermes
```

You need a running Hermes Agent backend to exercise the app end to end; without one you can
still run the unit tests and the type checker.

## Commits

- Conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`.
- No AI attribution (`Co-Authored-By` etc.) in commit messages.

## Tests

All of the following must pass before you open a PR:

```bash
cd app
npx tsc -p tsconfig.app.json --noEmit
npm run lint
npm test
```

The provisioner and the plugin are checked in CI too:

```bash
bash -n provisioner/prepare.sh            # syntax (shellcheck in CI)
cd hermes-plugin/droidbot_push && python -m pytest tests/ -q
```

## Security

- Never add secrets to client storage (localStorage/IndexedDB/cookies): session tokens live in
  memory only; the only persisted value is the backend URL.
- Never call `/api/env/reveal` or add anything that reads server environment values.
- Credentials only ever flow through Hermes' own vault prompts.

## Reporting bugs

Use the bug report template. Include: what you did, what you expected, what happened, and —
when relevant — the `sudo bash provisioner/prepare.sh --check` output and your Hermes version
(`hermes --version`). Security issues go through [SECURITY.md](SECURITY.md), never a public
issue.
