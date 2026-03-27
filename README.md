# tpm-utils-github-extension

Chromium **Manifest V3** extension that surfaces FilOzone **FOC** (Projects v2) context on
GitHub issues and pull requests: native-style sidebar card, placement in **Projects** above
**Milestone** when present, and **autosave** field edits (single select, number, text,
iteration) where the GitHub API allows.

## Quick start

```bash
npm install
npm run build
```

Load **unpacked** from `extension/dist/` in `chrome://extensions` (Developer mode).

## Documentation

- Extension usage, PAT scopes, configuration: [extension/README.md](extension/README.md)
- PAT permission tables: [docs/github-pat-permissions.md](docs/github-pat-permissions.md)
- Feature specs: [specs/](specs/)
