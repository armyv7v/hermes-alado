# Changelog

All notable changes to Alado are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-10-25

First public release: the MVP.

### Added

- Home with your bots (avatars, titles, colors, featured bot) and chat with any profile.
- Bot creation from the app (cloned from a chosen profile).
- Quiet chat, live "working" indicator, groups of bots, approvals.
- The bot's own computer: live desktop viewer with view / take over / hand back.
- Secure site logins through Hermes' browser vault (the bot never sees the password).
- Push notifications via the bundled `droidbot-push` Hermes plugin (finishes / needs you),
  with per-bot toggles.
- Voice, quick routines, dark ("hermes") & light ("clean") themes, installable PWA.
- Bring your bots from GrokBot.
- The `alado-companion` skill: every bot learns it is talked to from Alado.
- The provisioner (`provisioner/prepare.sh`): one-shot server setup — Chromium libraries,
  Bot Desktop packages, Caddy site (domain / sslip / tailscale), atomic PWA deploys from the
  GitHub release (sha256-verified), plugin and skill installs, `--check` diagnostics.
- GitHub Actions: CI (typecheck, lint, tests, build, shell script + plugin checks) and
  releases (`alado-pwa.tar.gz` + checksum attached on tags).

[0.1.0]: https://github.com/gabogabucho/hermes-alado/releases/tag/v0.1.0
