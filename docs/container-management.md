# Manage sites in the megahaRd Container

The panel is a single-screen dashboard. Its status card reflects the current
tab (`on-microsoft`, `in-megahard`, `about`, `trackers-detected`,
`no-trackers`, driven by `CURRENT_PANEL` in `background.js`).

## Included vs. allowed sites

- **SITES INCLUDED** lists every Microsoft-owned domain the extension contains.
  This list is rendered from `MICROSOFT_DOMAINS` in `src/background.js` (via
  the `get-microsoft-domains` message), so it cannot drift out of sync.
- **SITES YOU'VE ALLOWED** lists the custom domains you added. Hover a row and
  click the `X` to remove it.

_*Microsoft-owned domains cannot be removed.*_

## Add a site

1. Navigate to the site.
2. Open the megahaRd panel.
3. Click **Allow Site in megahaRd Container**.

The page reloads inside the container. From then on, Microsoft resources on
that site are allowed and Microsoft can track your activity there.

_Note that `about:` system pages cannot be added._

## Remove a site

1. Navigate to a site you previously allowed (or pick it from
   **SITES YOU'VE ALLOWED**).
2. Open the megahaRd panel.
3. Click **Remove Site from megahaRd Container**, or the `X` next to the
   domain in the list.

Removing a site means Log in with Microsoft stops working there and
Microsoft tracking cookies for it are deleted on next cleanup.
