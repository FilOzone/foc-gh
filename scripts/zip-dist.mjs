import archiver from 'archiver'
import { createWriteStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = path.join(root, 'extension', 'dist')
const manifestPath = path.join(dist, 'manifest.json')
const outPath = path.join(root, 'foc-gh-webstore.zip')

if (!existsSync(manifestPath)) {
  console.error('extension/dist is missing manifest.json — run `npm run build` first.')
  process.exit(1)
}

/** Chrome Web Store rejects uploads when manifest.json contains `key`. */
function addTree(archive, dir, relativeDir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    const rel = relativeDir ? path.join(relativeDir, name) : name
    const zipEntry = rel.split(path.sep).join('/')
    if (statSync(full).isDirectory()) {
      addTree(archive, full, rel)
    } else if (full === manifestPath) {
      const manifest = JSON.parse(readFileSync(full, 'utf8'))
      if ('key' in manifest) {
        delete manifest.key
      }
      archive.append(`${JSON.stringify(manifest, null, 2)}\n`, { name: zipEntry })
    } else {
      archive.file(full, { name: zipEntry })
    }
  }
}

const output = createWriteStream(outPath)
const archive = archiver('zip', { zlib: { level: 9 } })

const done = new Promise((resolve, reject) => {
  output.on('close', () => resolve())
  output.on('error', reject)
  archive.on('error', reject)
})

archive.pipe(output)
addTree(archive, dist, '')
await archive.finalize()
await done

console.log(
  `Wrote ${path.relative(root, outPath)} (${archive.pointer()} bytes) — manifest at zip root; manifest.key omitted (Chrome Web Store disallows it).`,
)
