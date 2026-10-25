# Alado — app

The Alado PWA: a light mobile client (React/Vite) for the
[Hermes](https://github.com/NousResearch/hermes-agent) agent. Talk to your bots, create chats
and groups, connect apps and manage the credential vault — all from your phone.

## Authentication modes

Hermes serves the dashboard in two modes. Alado detects them on its own:

| Mode | How it is detected | REST auth | WS auth |
|------|--------------------|-----------|---------|
| **loopback** (local `hermes dashboard`, no `public_url`) | The root page injects `window.__HERMES_SESSION_TOKEN__` | `X-Hermes-Session-Token` header | `/api/ws?token=<token>` |
| **gated** (`public_url` / OAuth) | The root page carries no token | Session cookie (`credentials: include`) | `POST /api/auth/ws-ticket` → `/api/ws?ticket=<ticket>` (single use, ~30 s) |

The loopback token lives **in memory only**; never in `localStorage`/`IndexedDB`. Only the
backend URL is persisted.

## Development

```bash
cd app
npm install
npm run dev
```

By default the Vite proxy targets the `HERMES_URL` env var (or a real gated backend). To develop
against a local Hermes:

```bash
hermes dashboard            # in another terminal, listening on http://localhost:9119
HERMES_URL=http://localhost:9119 npm run dev
```

The proxy forwards `/api`, `/auth`, `/login` and `/__hermes_root` to Hermes, and rewrites the
`Origin` header of WebSocket upgrades to pass the `_ws_host_origin_reason` guard.

### Opening from your phone on the LAN

`server.host: true` exposes the dev server on the network. In **loopback** mode, opening
`http://<lan-ip>:5173` is enough. In **gated** mode, logging in from a phone over plain `http://`
does **not** work: the `__Host-` cookie requires HTTPS. Test gated mode from your phone against
an HTTPS deployment.

## Verification

Do not run `npm run build`. Allowed verification:

```bash
npx tsc -p tsconfig.app.json --noEmit
npm run lint
npm test
```

## License

The JSON-RPC transport code under `src/lib/hermes/vendor/` is copied from
[`NousResearch/hermes-agent`](https://github.com/NousResearch/hermes-agent) (MIT, Copyright © 2025
Nous Research) and keeps its license header. See the root `NOTICE` file.
