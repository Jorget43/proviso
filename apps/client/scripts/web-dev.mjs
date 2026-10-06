// `npm run web`: the Expo dev server for the web build, behind a small proxy
// that adds the cross-origin isolation headers to every response.
//
// Why: expo-sqlite on the web runs SQLite as WebAssembly with
// SharedArrayBuffer, which browsers only allow on cross-origin-isolated pages.
// metro.config.js adds the headers to everything Metro serves, but Expo's CLI
// answers the page itself ("/") before Metro, without them. The production
// web host (the relay, apps/relay) sends the same two headers itself.
//
// Open http://localhost:8080 (Expo itself runs on 8081). Both ports can be
// changed (PORT, EXPO_PORT), e.g. to run beside `npm start` for a phone.
import { spawn } from 'node:child_process'
import http from 'node:http'
import net from 'node:net'

const EXPO = Number(process.env.EXPO_PORT ?? 8081)
const PORT = Number(process.env.PORT ?? 8080)
const ISOLATION = { 'cross-origin-embedder-policy': 'credentialless', 'cross-origin-opener-policy': 'same-origin' }

const expo = spawn('npx', ['expo', 'start', '--web', '--port', String(EXPO), ...process.argv.slice(2)], { stdio: 'inherit', shell: true })
expo.on('exit', code => process.exit(code ?? 0))

const server = http.createServer((req, res) => {
  const upstream = http.request({ host: 'localhost', port: EXPO, path: req.url, method: req.method, headers: req.headers }, up => {
    res.writeHead(up.statusCode ?? 502, { ...up.headers, ...ISOLATION })
    up.pipe(res)
  })
  upstream.on('error', () => { res.writeHead(502); res.end('Expo is still starting — refresh in a moment.') })
  req.pipe(upstream)
})

// Hot reload and the dev tools talk over websockets: pass them straight through.
server.on('upgrade', (req, socket, head) => {
  const up = net.connect(EXPO, 'localhost', () => {
    up.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n` +
      Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n')
    if (head?.length) up.write(head)
    up.pipe(socket); socket.pipe(up)
  })
  up.on('error', () => socket.destroy())
  socket.on('error', () => up.destroy())
})

server.listen(PORT, () => console.log(`\n  Proviso web (cross-origin isolated): http://localhost:${PORT}\n`))
