# Security Policy

Alado is a client for your own Hermes Agent server. Its security model is simple and strict:

- No secrets are ever stored on the phone (session tokens live in memory only).
- The client never calls `/api/env/reveal`.
- Credentials only ever flow through Hermes' own vault prompts — the bot never sees a password.

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Report them privately via
GitHub security advisories:

1. Go to **Security → Advisories → Report a vulnerability** in
   [this repository](https://github.com/gabogabucho/hermes-alado/security/advisories/new).
2. Include: affected version(s), a description of the issue, steps to reproduce, and any
   suggested fix.

You will receive a response as soon as possible. Once a fix is confirmed, we will publish a
coordinated disclosure and credit the reporter (unless you ask to stay anonymous).
