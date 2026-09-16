# Privacy Policy — megahaRd

megahaRd does not collect, transmit, or sell your data.

- All state (custom allowed sites in `domainsAddedToMegahardContainer`, `settings`, `CURRENT_PANEL`) stays in `browser.storage.local` on your device.
- The one-time cookie cleanup (`cookies`, `browsingData`) runs locally to delete Microsoft tracking cookies / service workers outside the container.
- Web-request handling (`webRequest`, `webRequestBlocking`, `<all_urls>`, `tabs`, `contextualIdentities`) runs locally to route tabs and block Microsoft sub-resources. No URLs or page content are sent anywhere.
- `management` is only used locally to detect Multi-Account Containers / Firefox Relay so the add-on interoperates with them.

Manifest declares this as:

```json
"data_collection_permissions": { "required": ["none"] }
```

Contact: https://github.com/futurester0x0/megahaRd/issues
