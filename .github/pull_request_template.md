## What does this PR do?

<!-- Brief description. Link issues: Fixes #123 -->

## Testing

- [ ] `npm run lint` passes
- [ ] `npm test` passes (46 unit tests)
- [ ] Manual QA in Firefox (`npm run dev` / temporary add-on):
  - [ ] Microsoft domain opens in megahaRd container
  - [ ] External link opens outside container
  - [ ] Allow / remove site in panel works

## Checklist

- [ ] No new permissions in `src/manifest.json` (or justified in description + `README.md`)
- [ ] No changes to `MICROSOFT_DOMAINS` in `src/background.js` (or listed below)
- [ ] English strings in `src/_locales/en/messages.json` updated if UI text changed
- [ ] Docs updated (`README.md`, `docs/container-management.md`, `PRIVACY.md` if behavior changed)
- [ ] No secrets, keys, or personal data committed (`git status`, `git diff --check` clean)
