# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

Only the latest `1.x` release (see
[Releases](https://github.com/futurester0x0/megahaRd/releases)) is supported
with security updates.

## Reporting a Vulnerability

**Do not open a public issue for vulnerabilities** (e.g. container bypass,
tracking-cookie leak, privilege escalation via permissions).

Instead, use GitHub's **private vulnerability reporting**:

1. Go to https://github.com/futurester0x0/megahaRd/security/advisories/new
2. Describe the affected version, steps to reproduce, and impact.
3. Include `about:support` extension section and console logs if relevant.

You can also open a regular issue at
https://github.com/futurester0x0/megahaRd/issues for non-sensitive bugs
(see [Contributing](./CONTRIBUTING.md)).

## What to Expect

* Acknowledgement within 7 days.
* A fix or mitigation in the next patch release where feasible.
* Credit on request once the advisory is published.

## Scope

* `src/background.js` container routing / cookie cleanup (`MICROSOFT_DOMAINS`)
* `src/content_script.js` tracker blocking / fence UI
* `src/panel.*` allow/remove-site handling
* `src/manifest.json` permissions (`<all_urls>`, `cookies`, `webRequestBlocking`, etc.)

Out of scope: Firefox itself, Multi-Account Containers, third-party sites.
See [Privacy](./PRIVACY.md) — no browsing data leaves your machine.
