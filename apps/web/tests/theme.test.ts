import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { light, dark, type Palette } from '@proviso/tokens'

// The NAS stylesheet carries its own copy of the palette as CSS variables;
// this keeps both themes identical to packages/tokens (the app's source).
const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8')

const cssName = (k: string) => '--' + k.replace(/Lt$/, '-lt').replace(/Md$/, '-md').replace(/Text$/, '-text')

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector)
  expect(start, `${selector} block`).toBeGreaterThanOrEqual(0)
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]))
}

const norm = (v: string) => v.replace(/\s+/g, '').toLowerCase()

function expectMatches(vars: Record<string, string>, p: Palette) {
  for (const [k, v] of Object.entries(p)) expect(norm(vars[cssName(k)] ?? 'missing'), `${cssName(k)}`).toBe(norm(v))
}

describe('NAS stylesheet palette', () => {
  it('light matches the tokens', () => expectMatches(block(':root {'), light))
  it('dark (chosen) matches the tokens', () => expectMatches(block(':root[data-theme="dark"]'), dark))
  it('dark (following the device) matches the tokens', () => expectMatches(block(':root:not([data-theme="light"]):not([data-theme="dark"])'), dark))
})
