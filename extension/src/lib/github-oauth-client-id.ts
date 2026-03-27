/**
 * Injected at build time by `scripts/build.mjs` (`esbuild` `define`).
 * Public OAuth App Client ID only — never a client secret.
 */
declare const __GITHUB_OAUTH_CLIENT_ID__: string

export const GITHUB_OAUTH_CLIENT_ID: string =
  typeof __GITHUB_OAUTH_CLIENT_ID__ === 'string' ? __GITHUB_OAUTH_CLIENT_ID__ : ''
