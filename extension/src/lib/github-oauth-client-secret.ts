/**
 * Injected at build time by `scripts/build.mjs` (`esbuild` `define`), service worker only.
 * Treat as sensitive: anyone with the built `service-worker.js` can read it.
 */
declare const __GITHUB_OAUTH_CLIENT_SECRET__: string

export const GITHUB_OAUTH_CLIENT_SECRET: string =
  typeof __GITHUB_OAUTH_CLIENT_SECRET__ === 'string' ? __GITHUB_OAUTH_CLIENT_SECRET__ : ''
