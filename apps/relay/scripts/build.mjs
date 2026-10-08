// Bundles the relay into one file, dist/relay.mjs, with no dependencies left
// to install: it imports only Node built-ins at run time. The Docker image
// (Dockerfile here) runs exactly this file.
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
await build({
  absWorkingDir: root,
  entryPoints: ['src/main.ts'],
  outfile: 'dist/relay.mjs',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  packages: 'bundle',
  external: ['node:*'],
  alias: { '@proviso/sync': '../../packages/sync/src' },
  legalComments: 'none',
  logLevel: 'info',
})
