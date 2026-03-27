import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = path.join(root, 'extension', 'dist')

mkdirSync(dist, { recursive: true })

await esbuild.build({
  entryPoints: [path.join(root, 'extension', 'src', 'background', 'service-worker.ts')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  outfile: path.join(dist, 'service-worker.js'),
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

const manifestSrc = path.join(root, 'extension', 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestSrc, 'utf8'))
writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2))

copyFileSync(path.join(root, 'extension', 'src', 'options', 'options.html'), path.join(dist, 'options.html'))
copyFileSync(path.join(root, 'extension', 'src', 'styles', 'sidebar.css'), path.join(dist, 'sidebar.css'))

console.log('Built extension → extension/dist/')
