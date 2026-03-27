import { GITHUB_OAUTH_CLIENT_ID } from '../lib/github-oauth-client-id.js'
import { GITHUB_OAUTH_CLIENT_SECRET } from '../lib/github-oauth-client-secret.js'
import {
  buildGithubAuthorizeUrl,
  createS256CodeChallenge,
  exchangeGithubOAuthCode,
  generateCodeVerifier,
  parseOAuthRedirectUrl,
  randomOAuthState,
} from '../lib/github-oauth-pkce.js'
import { STORAGE_KEYS, loadConfig, resolveGithubBearer, type AuthMethod } from '../lib/project-config.js'

let pendingOAuthVerifier: string | null = null
let pendingOAuthState: string | null = null

export async function handleGithubOAuthStart(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const clientId = GITHUB_OAUTH_CLIENT_ID.trim()
  if (!clientId) {
    return {
      ok: false,
      error:
        'Missing GITHUB_OAUTH_CLIENT_ID. Build with your OAuth App Client ID (see docs/github-oauth-app.md).',
    }
  }

  const clientSecret = GITHUB_OAUTH_CLIENT_SECRET.trim()
  if (!clientSecret) {
    return {
      ok: false,
      error:
        'Missing GITHUB_OAUTH_CLIENT_SECRET. GitHub OAuth Apps require it for the token exchange; add it to .env.local, rebuild, and retry (see docs/github-oauth-app.md).',
    }
  }

  const verifier = generateCodeVerifier()
  const challenge = await createS256CodeChallenge(verifier)
  const state = randomOAuthState()
  pendingOAuthVerifier = verifier
  pendingOAuthState = state

  const redirectUri = chrome.identity.getRedirectURL()
  const url = buildGithubAuthorizeUrl({
    clientId,
    redirectUri,
    state,
    codeChallenge: challenge,
  })

  const responseUrl = await new Promise<string | undefined>((resolve) => {
    chrome.identity.launchWebAuthFlow({ url, interactive: true }, (u) => {
      resolve(u)
    })
  })

  if (!responseUrl) {
    pendingOAuthVerifier = null
    pendingOAuthState = null
    const err = chrome.runtime.lastError?.message ?? 'Authorization was cancelled or failed.'
    return { ok: false, error: err }
  }

  const parsed = parseOAuthRedirectUrl(responseUrl)
  if (parsed.error) {
    pendingOAuthVerifier = null
    pendingOAuthState = null
    const msg =
      parsed.errorDescription ? `${parsed.error}: ${parsed.errorDescription}` : parsed.error
    return { ok: false, error: msg }
  }

  if (!parsed.code || !parsed.state) {
    pendingOAuthVerifier = null
    pendingOAuthState = null
    return { ok: false, error: 'GitHub did not return an authorization code.' }
  }

  if (parsed.state !== pendingOAuthState) {
    pendingOAuthVerifier = null
    pendingOAuthState = null
    return { ok: false, error: 'OAuth state mismatch. Try again.' }
  }

  const v = pendingOAuthVerifier
  pendingOAuthVerifier = null
  pendingOAuthState = null

  if (!v) {
    return { ok: false, error: 'OAuth internal state was lost. Try again.' }
  }

  const exchanged = await exchangeGithubOAuthCode({
    clientId,
    code: parsed.code,
    redirectUri,
    codeVerifier: v,
    clientSecret,
  })

  if (!exchanged.ok) {
    return exchanged
  }

  const expiresAt =
    typeof exchanged.expiresIn === 'number' && exchanged.expiresIn > 0 ?
      Date.now() + exchanged.expiresIn * 1000
    : undefined

  const patch: Record<string, unknown> = {
    [STORAGE_KEYS.githubApiToken]: exchanged.accessToken,
    [STORAGE_KEYS.githubTokenKind]: 'oauth',
    [STORAGE_KEYS.authMethod]: 'oauth',
  }

  if (expiresAt !== undefined) {
    patch[STORAGE_KEYS.oauthTokenExpiresAt] = expiresAt
  } else {
    await chrome.storage.local.remove(STORAGE_KEYS.oauthTokenExpiresAt)
  }

  await chrome.storage.local.set(patch)

  return { ok: true }
}

export async function handleGithubOAuthDisconnect(): Promise<{ ok: true } | { ok: false; error: string }> {
  await chrome.storage.local.remove(STORAGE_KEYS.oauthTokenExpiresAt)
  await chrome.storage.local.set({
    [STORAGE_KEYS.githubApiToken]: '',
    [STORAGE_KEYS.githubTokenKind]: '',
    [STORAGE_KEYS.authMethod]: 'none',
  })
  return { ok: true }
}

export async function handleGetAuthStatus(): Promise<{
  ok: true
  authMethod: AuthMethod
  hasToken: boolean
}> {
  const cfg = await loadConfig()
  const hasToken = resolveGithubBearer(cfg) !== null
  return {
    ok: true,
    authMethod: cfg.authMethod,
    hasToken,
  }
}
