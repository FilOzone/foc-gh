# Data model: Build and distribution workflows

**Feature**: [spec.md](./spec.md)

Abstract entities (no new runtime persistence).

## DistributionChannel

| Field | Description |
|--------|-------------|
| `id` | Logical name: `local-unpacked` \| `chrome-web-store` |
| `stableExtensionIdPolicy` | **local**: derived from committed public key (`manifest.key` in dist); **store**: assigned by Google at listing time |
| `artifact` | Reference to **BuildArtifact** |

## BuildArtifact

| Field | Description |
|--------|-------------|
| `path` | `extension/dist/` (directory) or `foc-gh-webstore.zip` (file at repo root) |
| `manifestIncludesKey` | **true** for dist; **false** for store zip |
| `producedBy` | Script command: `npm run build` \| `npm run build:zip` |

## OAuthApplicationBinding

| Field | Description |
|--------|-------------|
| `channel` | Which **DistributionChannel** this GitHub OAuth App serves |
| `githubOAuthClientId` | Public client identifier |
| `githubOAuthClientSecret` | Confidential secret; never in git |
| `authorizationCallbackUrl` | `https://<extension-id>.chromiumapp.org/` matching that channel’s extension ID |

**Validation rules**

- For a given **release** intended for store users, `OAuthApplicationBinding.channel` MUST be `chrome-web-store` and callback MUST use the **dashboard** extension ID.
- For **local dev**, binding MUST use the **logged** stable ID from `npm run build`.

## RepositorySecret (CI)

| Field | Description |
|--------|-------------|
| `name` | e.g. `GITHUB_OAUTH_CLIENT_ID` (store job) |
| `scope` | GitHub **Actions** secret; available only to allowed workflows |

**Relationships**

- **BuildArtifact** is produced from repository sources + one **OAuthApplicationBinding**’s credentials (via env at build time).
- **RepositorySecret** maps host storage to env names consumed by build scripts.
