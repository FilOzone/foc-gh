# Chrome Web Store listing: privacy practices and justifications

**Last updated:** 2026-08-21 (v0.7.0 submission)

Canonical copies of the text entered in the Chrome Web Store Developer Dashboard for the store build (`haicdejjcnecapheflpdpdngflffejpf`), under the item's **Privacy practices** tab. Keep this file in sync with the dashboard: the store BLOCKS publishing (API error 400 "Publish condition not met") whenever a required justification field is empty, and it re-requires this tab whenever the permission or content-script surface changes in `manifest.json`. When you change permissions, update the matching justification here first, then paste it into the dashboard.

Publishing process itself: [extension/README.md](../extension/README.md) ("Publishing a new version to Chrome Web Store" and "Publish from CI"). Note the upload step can succeed while the publish step fails on this tab; the uploaded draft stays in the dashboard and can be submitted manually after fixing the fields. Broad host permissions flag the item for potentially in-depth (slower) review. If "Publish later" is selected at submission, a staged item expires 30 days after passing review.

## Single purpose

Help the FOC team manage GitHub issues, pull requests, and project boards across organizations by augmenting GitHub's own UI.

## Permission justifications

### storage

chrome.storage.local holds only what the extension needs to work: user settings from the Options page (target org project URL, repo list, optional toggles such as auto-expand for the Projects panel), and, when the user signs in, either the encrypted-at-rest OAuth token bundle or the personal access token they chose to save. Nothing is synced off-device by this permission; it is the standard MV3 place to persist configuration and credentials for this single-purpose GitHub productivity tool.

### identity

The identity permission is used solely for Connect GitHub OAuth: chrome.identity.getRedirectURL() supplies the extension's https://<extension-id>.chromiumapp.org/ redirect, and chrome.identity.launchWebAuthFlow opens GitHub's authorize page and returns the redirect URL so the extension can complete PKCE and exchange the code for an access token. No other use of the Identity API is made.

### activeTab

activeTab supports a single optional feature: a user-invoked keyboard shortcut (default Alt+Shift+C) that copies the current page's title and URL to the clipboard as a rich-text/Markdown link. The user's explicit command grants temporary access to the active tab so a small script can write to the clipboard. The extension reads no page content through this permission and does nothing without that explicit user gesture.

### scripting

chrome.scripting is used in exactly one place: when the user presses the copy-link keyboard shortcut, the service worker calls chrome.scripting.executeScript on the active tab to run a few-line function that writes the already-composed link (page title and URL) to the clipboard as text/html and text/plain. It reads no page data, injects nothing on page load, and never runs without the user's explicit command.

### Host permissions

https://github.com/*: content scripts augment GitHub's own UI on pages the user visits: on issue and PR pages they add the team's cross-org project board to GitHub's native Projects picker and Projects section, and on project board views they add filter enhancements. Broad github.com matching is required because GitHub is a single-page app that navigates between pages without full reloads, so scripts must be present before navigation reaches those pages; the scripts stay inert everywhere else. https://api.github.com/*: the service worker calls GitHub's official GraphQL and REST APIs with the user's own token to read and update the user's project board items. No other hosts are contacted.

## Remote code

None. All code ships in the extension package; nothing is fetched or evaluated from remote sources.

## Data usage declarations

The extension collects no user data beyond the user's own GitHub credential (PAT or OAuth token), stored locally on the device and sent only to github.com/api.github.com on the user's behalf. Certifications: no sale of data to third parties, no use or transfer unrelated to the extension's single purpose, no use or transfer to determine creditworthiness or for lending purposes.
