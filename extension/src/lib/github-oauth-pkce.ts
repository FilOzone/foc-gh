/**
 * GitHub OAuth 2.0 with PKCE (RFC 7636) for public OAuth apps.
 * Scopes align with `docs/github-pat-permissions.md` (repo + org projects).
 */

/** Space-separated scopes for authorize URL (classic OAuth scope names). */
export const GITHUB_OAUTH_SCOPE_STRING = 'repo read:org project'

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** RFC 7636: 43–128 character verifier from unreserved characters. */
export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

export async function createS256CodeChallenge(verifier: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64UrlEncode(new Uint8Array(hash))
}

export function randomOAuthState(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

export function buildGithubAuthorizeUrl(params: {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
  scope?: string
}): string {
  const u = new URL('https://github.com/login/oauth/authorize')
  u.searchParams.set('client_id', params.clientId)
  u.searchParams.set('redirect_uri', params.redirectUri)
  u.searchParams.set('scope', params.scope ?? GITHUB_OAUTH_SCOPE_STRING)
  u.searchParams.set('state', params.state)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('code_challenge', params.codeChallenge)
  u.searchParams.set('code_challenge_method', 'S256')
  return u.toString()
}

type GithubTokenErrorJson = {
  error?: string
  error_description?: string
  error_uri?: string
}

type GithubTokenOkJson = {
  access_token?: string
  token_type?: string
  scope?: string
  expires_in?: number
  refresh_token?: string
  refresh_token_expires_in?: number
}

export async function exchangeGithubOAuthCode(params: {
  clientId: string
  code: string
  redirectUri: string
  codeVerifier: string
  /** Classic GitHub OAuth Apps require this at token exchange; optional for PKCE-only setups. */
  clientSecret?: string
}): Promise<
  | { ok: true; accessToken: string; scope?: string; expiresIn?: number }
  | { ok: false; error: string }
> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  })
  const secret = params.clientSecret?.trim()
  if (secret) {
    body.set('client_secret', secret)
  }

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!res.ok) {
    return { ok: false, error: `Token exchange failed (HTTP ${res.status}).` }
  }

  const data = (await res.json()) as GithubTokenErrorJson & GithubTokenOkJson

  if (data.error) {
    const desc = data.error_description ? `${data.error}: ${data.error_description}` : data.error
    return { ok: false, error: desc }
  }

  const token = data.access_token
  if (!token || typeof token !== 'string') {
    return { ok: false, error: 'GitHub did not return an access_token.' }
  }

  const expiresIn =
    typeof data.expires_in === 'number' && Number.isFinite(data.expires_in) ? data.expires_in : undefined

  return {
    ok: true,
    accessToken: token,
    scope: typeof data.scope === 'string' ? data.scope : undefined,
    expiresIn,
  }
}

export function parseOAuthRedirectUrl(redirectUrl: string): {
  code?: string
  state?: string
  error?: string
  errorDescription?: string
} {
  try {
    const u = new URL(redirectUrl)
    const code = u.searchParams.get('code') ?? undefined
    const state = u.searchParams.get('state') ?? undefined
    const error = u.searchParams.get('error') ?? undefined
    const errorDescription = u.searchParams.get('error_description') ?? undefined
    return { code, state, error, errorDescription }
  } catch {
    return {}
  }
}
