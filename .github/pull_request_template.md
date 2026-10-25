## What

<!-- One sentence: what does this change and why? Reference the issue (#n) if there is one. -->

## Checks

- [ ] `cd app && npx tsc -p tsconfig.app.json --noEmit`
- [ ] `cd app && npm run lint`
- [ ] `cd app && npm test`
- [ ] No secrets in client storage; no `/api/env/reveal` anywhere
- [ ] The change passes the "light, everyday" bar (see CONTRIBUTING.md)
- [ ] Conventional commit message, no AI attribution

## Notes for the reviewer

<!-- Anything non-obvious: Hermes contract sources checked, vendored files untouched, etc. -->
