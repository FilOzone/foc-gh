import { spawnSync } from 'node:child_process'
import { config as loadEnv } from 'dotenv'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const envLocal = path.join(root, '.env.local')
if (existsSync(envLocal)) {
  loadEnv({ path: envLocal, quiet: true })
}

/** chrome-webstore-upload-cli expects these names; we only accept prefixed inputs (see .env.example). */
function webstoreCliEnv() {
  const cid = (process.env.CHROME_WEBSTORE_CLIENT_ID ?? '').trim()
  const secret = (process.env.CHROME_WEBSTORE_CLIENT_SECRET ?? '').trim()
  const refresh = (process.env.CHROME_WEBSTORE_REFRESH_TOKEN ?? '').trim()
  const ext = (process.env.CHROME_WEBSTORE_EXTENSION_ID ?? '').trim()

  const missing = []
  if (!cid) missing.push('CHROME_WEBSTORE_CLIENT_ID')
  if (!secret) missing.push('CHROME_WEBSTORE_CLIENT_SECRET')
  if (!refresh) missing.push('CHROME_WEBSTORE_REFRESH_TOKEN')
  if (!ext) missing.push('CHROME_WEBSTORE_EXTENSION_ID')

  if (missing.length > 0) {
    console.error(
      `chrome-webstore: set ${missing.join(', ')} in the environment or .env.local (see .env.example). Unprefixed CLIENT_ID / CLIENT_SECRET are not supported.`,
    )
    process.exit(1)
  }

  return {
    ...process.env,
    CLIENT_ID: cid,
    CLIENT_SECRET: secret,
    REFRESH_TOKEN: refresh,
    EXTENSION_ID: ext,
  }
}

const sub = process.argv[2]
const zipPath = path.join(root, 'foc-gh-webstore.zip')
const args =
  sub === 'upload' ?
    ['chrome-webstore-upload', 'upload', '--source', zipPath]
  : ['chrome-webstore-upload', '--source', zipPath]

const result = spawnSync('npx', args, {
  cwd: root,
  stdio: 'inherit',
  env: webstoreCliEnv(),
  shell: process.platform === 'win32',
})

process.exit(result.status === null ? 1 : result.status)
