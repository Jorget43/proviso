// https://docs.expo.dev/guides/using-eslint/
const { defineConfig, globalIgnores } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    // Same as apps/web (eslint-config-next/typescript): `any` only with a
    // disable comment saying why.
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
  globalIgnores(['dist/**', '.expo/**', 'web-build/**']),
])
