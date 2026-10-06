// Metro config for the Proviso client. Expo detects the npm workspace
// (packages/core, packages/tokens) on its own; the additions are for
// expo-sqlite on the web, which runs SQLite as WebAssembly and needs
// SharedArrayBuffer — so .wasm assets, and cross-origin isolation headers on
// the dev server (the production web host must send the same two headers).
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)
config.resolver.assetExts.push('wasm')
config.server.enhanceMiddleware = middleware => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  middleware(req, res, next)
}

module.exports = config
