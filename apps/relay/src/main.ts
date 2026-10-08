// Starts the relay. Settings come from the environment:
//   PORT      (default 8787)
//   DATA_DIR  where relay.db lives (default ./data; /data in the Docker image)
// It speaks plain HTTP: put it behind HTTPS (Tailscale Serve, or a reverse
// proxy), because phones refuse plain http to anything but localhost.

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createRelay } from './server'

const port = Number(process.env.PORT ?? 8787)
const dir = process.env.DATA_DIR ?? './data'
mkdirSync(dir, { recursive: true })

const { server } = createRelay({
  dataFile: join(dir, 'relay.db'),
  version: process.env.PROVISO_VERSION ?? 'dev',
  log: line => console.log(`${new Date().toISOString()} ${line}`),
})
server.listen(port, () => console.log(`Proviso relay listening on port ${port}, data in ${dir}`))

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
