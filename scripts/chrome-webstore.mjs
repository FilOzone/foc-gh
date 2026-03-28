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

const sub = process.argv[2]
const zipPath = path.join(root, 'foc-gh-webstore.zip')
const args =
  sub === 'upload' ?
    ['chrome-webstore-upload', 'upload', '--source', zipPath]
  : ['chrome-webstore-upload', '--source', zipPath]

const result = spawnSync('npx', args, {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
})

process.exit(result.status === null ? 1 : result.status)
