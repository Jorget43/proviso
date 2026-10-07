// `npm run eas -- <args>`: runs the EAS CLI with apps/client/.env.local
// loaded, because EAS doesn't read it and app.config.js needs EAS_PROJECT_ID
// from there (see that file). The CLI isn't a dependency (it's large and
// only needed on a developer's machine), so npx fetches it.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const envFile = fileURLToPath(new URL('../.env.local', import.meta.url))
if (existsSync(envFile)) process.loadEnvFile(envFile)
if (!process.env.EAS_PROJECT_ID) {
  console.error('EAS_PROJECT_ID is not set. Put it in apps/client/.env.local (see app.config.js).')
  process.exit(1)
}
const { status } = spawnSync('npx', ['--yes', 'eas-cli@latest', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
process.exit(status ?? 1)
