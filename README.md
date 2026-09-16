# megahaRd

[![CI](https://github.com/futurester0x0/megahaRd/actions/workflows/ci.yml/badge.svg)](https://github.com/futurester0x0/megahaRd/actions/workflows/ci.yml)

**Prevent Microsoft from tracking your visits to other websites**

megahaRd is an add-on you can install on Firefox to prevent Microsoft from tracking your activity on other websites, so you can continue to use Microsoft while protecting your privacy.

> Based on [mozilla/contain-facebook](https://github.com/mozilla/contain-facebook) (MPL-2.0), reworked to isolate Microsoft domains instead of Facebook. See [License](./LICENSE).

**Note:** To learn more about Containers in general, see [Firefox Multi-Account Containers](https://support.mozilla.org/kb/containers).

## How does megahaRd work?

The Add-on keeps Microsoft in a separate Container to prevent it from following your activity on other websites. When you first install the add-on, it signs you out of Microsoft and deletes the cookies that Microsoft uses to track you on other websites.

Every time you visit Microsoft, it will open in its own container, separate from other websites you visit. You can login to Microsoft within its container. When browsing outside the container, Microsoft won’t be able to easily collect your browsing data and connect it to your Microsoft identity.

Isolated domains include Microsoft 365 / Office (`microsoft.com`, `microsoftonline.com`, `office.com`, `sharepoint.com`, `onedrive.com`, `teams.com`, `skype.com`), Windows / Azure (`windows.com`, `azure.com`), search (`bing.com`, `msn.com`), GitHub (`github.com`), professional (`linkedin.com`), and gaming (`xbox.com`, `minecraft.net`, `blizzard.com` and others) — all contained in the single `megahaRd` container. See `MICROSOFT_DOMAINS` in `src/background.js` for the full list.

## How do I enable megahaRd?

1. Build/load this add-on (see Development below). This will log you out of Microsoft and delete the cookies it’s been using to track you.
2. Open Microsoft and use it like you normally would. Firefox will automatically switch to the megahaRd tab for you.
3. If you click on a link to a page outside of Microsoft or type in another website in the address bar, Firefox will load them outside of the megahaRd Container

## How does this affect Microsoft’s features?

megahaRd prevents Microsoft from linking your activity on other websites to your Microsoft identity. Therefore, the following will not work outside the container:

### “Log in with Microsoft” buttons on other websites.

Because you are logged into Microsoft only in the Container, “Log in with Microsoft” buttons on other websites will show a fence badge. Click to allow the site if needed.

## Will this protect me from Microsoft completely?

This add-on does not prevent Microsoft from handling the data it already has about you. Microsoft still will have access to everything that you do while you are on microsoft.com / outlook / office apps, etc.

In addition to this add-on, consider changing your Microsoft settings, using Private Browsing and Tracking Protection, blocking third-party cookies, and/or using [Firefox Multi-Account Containers](https://addons.mozilla.org/firefox/addon/multi-account-containers/) extension to further limit tracking.

## Requirements

- Firefox 115 ESR or later (desktop). Android / private windows with disabled containers are not supported.
- Firefox Container Tabs enabled (Firefox enables this by default when the add-on is installed).

## Install

Until the AMO listing is published:

1. `npm run build`
2. In Firefox go to `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → pick `web-ext-artifacts/*.zip`, or `npm run dev` for live reload.

## Permissions — why each is needed

- `<all_urls>` + `webRequest` + `webRequestBlocking`: route Microsoft domains into the container and block Microsoft sub-resource trackers on other sites.
- `cookies` + `browsingData`: one-time cleanup of Microsoft tracking cookies / service workers outside the container on install.
- `contextualIdentities` + `tabs`: create/manage the `megahaRd` container and reopen tabs in the right context.
- `storage`: remember your custom allowed sites and settings locally.
- `management`: detect Multi-Account Containers / Firefox Relay so we don't fight them.

No browsing data leaves your machine (see [Privacy](./PRIVACY.md)).

## Known limitations

- Microsoft-owned sites (including `github.com`, `linkedin.com`, `xbox.com`, …) always stay in the container and cannot be removed from the panel. Allowing a third-party site lets Microsoft track you there.
- Translations other than English may fall back to English for new strings until locales are re-synced.
- MV2 build. MV3 migration is planned but not required by Firefox AMO yet.

## Development

1. `npm install`
2. `npm run dev` (`web-ext run -s src/`)

### Testing
`npm run test`

or

`npm run lint`

for just the linter

### Building

1. `npm run build`
2. use the add-on zip file generated in the `web-ext-artifacts` folder


### Links

- [License](./LICENSE)
- [Privacy](./PRIVACY.md)
- [Contributing](./CONTRIBUTING.md)
- [Code Of Conduct](./CODE_OF_CONDUCT.md)
- [Security](./SECURITY.md)
- Upstream: https://github.com/mozilla/contain-facebook
