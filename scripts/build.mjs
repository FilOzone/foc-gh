import { config as loadEnv } from 'dotenv'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

/** Matches Chromium’s extension id derivation from the manifest `key` (DER PKCS#1 RSA public, base64). */
function extensionIdFromManifestKeyBase64(b64) {
  const der = Buffer.from(b64.replace(/\s+/g, ''), 'base64')
  const hash = createHash('sha256').update(der).digest()
  let id = ''
  for (let i = 0; i < 16; i++) {
    id += String.fromCharCode(97 + (hash[i] >>> 4))
    id += String.fromCharCode(97 + (hash[i] & 0xf))
  }
  return id
}

const root = fileURLToPath(new URL('..', import.meta.url))
const envLocal = path.join(root, '.env.local')
if (existsSync(envLocal)) {
  loadEnv({ path: envLocal, quiet: true })
}

const dist = path.join(root, 'extension', 'dist')
const manifestSrc = path.join(root, 'extension', 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestSrc, 'utf8'))

/** Chrome Web Store rejects packages when `description` exceeds this (manifest “summary from package”). */
const CHROME_WEBSTORE_DESCRIPTION_MAX = 132
if (typeof manifest.description === 'string' && manifest.description.length > CHROME_WEBSTORE_DESCRIPTION_MAX) {
  console.error(
    `build: extension/manifest.json "description" is ${manifest.description.length} characters; Chrome Web Store allows at most ${CHROME_WEBSTORE_DESCRIPTION_MAX}. Shorten it before uploading.`,
  )
  process.exit(1)
}

const manifestKeyPath = path.join(root, 'extension', 'manifest-id-public.b64')
if (!existsSync(manifestKeyPath)) {
  console.error(
    'build: missing extension/manifest-id-public.b64 (committed public key for a stable extension ID on unpacked loads).',
  )
  process.exit(1)
}
const manifestKeyB64 = readFileSync(manifestKeyPath, 'utf8').trim().replace(/\s+/g, '')
if (!manifestKeyB64) {
  console.error('build: extension/manifest-id-public.b64 is empty.')
  process.exit(1)
}
manifest.key = manifestKeyB64

mkdirSync(dist, { recursive: true })

const iconsSrc = path.join(root, 'extension', 'icons')
const iconsDist = path.join(dist, 'icons')
if (existsSync(iconsSrc)) {
  mkdirSync(iconsDist, { recursive: true })
  const icons = readdirSync(iconsSrc)
  for (const icon of icons) {
    copyFileSync(path.join(iconsSrc, icon), path.join(iconsDist, icon))
  }
}

const oauthClientId = process.env.GITHUB_OAUTH_CLIENT_ID ?? ''
const oauthClientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET ?? ''

await esbuild.build({
  entryPoints: [path.join(root, 'extension', 'src', 'background', 'service-worker.ts')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  outfile: path.join(dist, 'service-worker.js'),
  define: {
    __GITHUB_OAUTH_CLIENT_ID__: JSON.stringify(oauthClientId),
    __GITHUB_OAUTH_CLIENT_SECRET__: JSON.stringify(oauthClientSecret),
  },
})

await esbuild.build({
  entryPoints: [path.join(root, 'extension', 'src', 'content', 'issue-sidebar.ts')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  outfile: path.join(dist, 'content.js'),
})

await esbuild.build({
  entryPoints: [path.join(root, 'extension', 'src', 'content', 'pr-expand-main-world.ts')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  outfile: path.join(dist, 'pr-expand-main-world.js'),
})

await esbuild.build({
  entryPoints: [path.join(root, 'extension', 'src', 'options', 'options.ts')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  outfile: path.join(dist, 'options.js'),
})

writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2))

copyFileSync(path.join(root, 'extension', 'src', 'options', 'options.html'), path.join(dist, 'options.html'))
copyFileSync(path.join(root, 'extension', 'src', 'styles', 'sidebar.css'), path.join(dist, 'sidebar.css'))

const derivedId = extensionIdFromManifestKeyBase64(manifestKeyB64)
console.log('Built extension → extension/dist/')
console.log(`Stable extension ID (manifest key): ${derivedId}`)
console.log(`OAuth redirect: https://${derivedId}.chromiumapp.org/`)
