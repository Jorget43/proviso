#!/usr/bin/env node
// End-of-session drift check (proviso-close-session skill). Read-only: it
// reports what looks out of step; fixing it is the session's job.
//
// Checks:
//   git      — uncommitted changes, commits not pushed, local branches not merged
//   phases   — the newest "(Phase N)" commit has a CLAUDE.md entry, and the
//              NAS ↔ app feature table and plan doc have caught up with it
//   dates    — the Backlog's "next steps (as of …)" date is recent
//   schema   — Drizzle SCHEMA_VERSION matches its migration count; Prisma has
//              a migration for each new Drizzle one (both apps live)
//   github   — the repo has a description (public API, no token needed)
//
// Usage: node scripts/session-check.mjs [--offline]
// Exit 0 always; lines start with ✓ (fine) or ! (look at this).

import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const offline = process.argv.includes('--offline')
const read = p => readFileSync(path.join(ROOT, p), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
const ok = m => console.log(`✓ ${m}`)
const warn = m => console.log(`! ${m}`)

// ── git ──
const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
const dirty = git('status', '--porcelain')
dirty ? warn(`uncommitted changes on ${branch}:\n${dirty.split('\n').map(l => '    ' + l).join('\n')}`) : ok(`working tree clean (${branch})`)
try {
  const ahead = git('rev-list', '--count', '@{u}..HEAD')
  Number(ahead) > 0 ? warn(`${ahead} commit(s) on ${branch} not pushed`) : ok(`${branch} is pushed`)
} catch {
  warn(`${branch} has no upstream (never pushed)`)
}
const unmerged = git('branch', '--no-merged', 'master', '--format=%(refname:short)').split('\n').filter(Boolean)
unmerged.length ? warn(`local branches not merged to master: ${unmerged.join(', ')}`) : ok('no unmerged local branches')

// ── phases ──
const subjects = git('log', '-200', '--format=%s').split('\n')
const phaseNums = subjects.flatMap(s => [...s.matchAll(/\(Phases? (\d+)(?:[–-](\d+))?\)/g)].map(m => Number(m[2] ?? m[1])))
const latest = phaseNums.length ? Math.max(...phaseNums) : null
const claude = read('CLAUDE.md')
if (latest !== null) {
  const documented = [...claude.matchAll(/^### Phases? (\d+)(?:[–-](\d+))?\b/gm)].some(m => Number(m[1]) <= latest && latest <= Number(m[2] ?? m[1]))
  documented ? ok(`Phase ${latest} has a CLAUDE.md entry`) : warn(`Phase ${latest} (newest in git log) has no "### Phase ${latest}" entry in CLAUDE.md`)
  const table = claude.match(/Where each feature lives \(NAS ↔ app\), as of Phase (\d+)/)
  if (!table) warn('CLAUDE.md has no "Where each feature lives (NAS ↔ app), as of Phase N" table')
  else Number(table[1]) < latest ? warn(`feature table is as of Phase ${table[1]}; latest is ${latest} — review it and bump the heading`) : ok(`feature table is as of Phase ${table[1]}`)
  const plan = read('docs/plan-modelling-and-ux.md').split('\n').find(l => l.startsWith('**Status:')) ?? ''
  const planMax = Math.max(0, ...[...plan.matchAll(/Phases? (\d+)(?:[–-](\d+))?/g)].map(m => Number(m[2] ?? m[1])))
  planMax < latest ? warn(`docs/plan-modelling-and-ux.md status mentions up to Phase ${planMax}; latest is ${latest} (fine if that phase wasn't part of the plan)`) : ok('plan status is current')
}

// ── dates ──
const asOf = claude.match(/### The app — next steps \(as of (\d{4}-\d{2}-\d{2})\)/)
if (!asOf) warn('Backlog heading "The app — next steps (as of YYYY-MM-DD)" not found')
else {
  const days = Math.floor((Date.now() - Date.parse(asOf[1])) / 86_400_000)
  days > 1 ? warn(`"The app — next steps" is as of ${asOf[1]} (${days} days ago) — refresh it and "Start here"`) : ok(`"next steps" dated ${asOf[1]}`)
}

// ── schema ──
const version = Number(read('packages/core/src/schema.ts').match(/SCHEMA_VERSION = (\d+)/)?.[1])
const drizzle = readdirSync(path.join(ROOT, 'packages/core/drizzle')).filter(f => f.endsWith('.sql'))
drizzle.length === version ? ok(`SCHEMA_VERSION ${version} = ${drizzle.length} Drizzle migration(s)`) : warn(`SCHEMA_VERSION is ${version} but there are ${drizzle.length} Drizzle migrations`)
const prismaDir = path.join(ROOT, 'apps/web/prisma/migrations')
const prisma = readdirSync(prismaDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
const prismaTags = new Set(prisma.map(n => n.replace(/^\d+_/, '')))
const missing = drizzle.map(f => f.replace(/^\d+_|\.sql$/g, '')).filter(t => t !== 'baseline' && !prismaTags.has(t))
missing.length ? warn(`Drizzle migrations with no Prisma twin (NAS schema may lag): ${missing.join(', ')}`) : ok('every Drizzle migration has a Prisma twin')

// ── github ──
if (!offline) {
  try {
    const remote = git('remote', 'get-url', 'origin').match(/github\.com[/:]([^/]+\/[^/.]+)/)?.[1]
    const res = await fetch(`https://api.github.com/repos/${remote}`, { headers: { 'User-Agent': 'proviso-session-check' } })
    const repo = await res.json()
    if (!res.ok) warn(`GitHub API: ${repo.message ?? res.status}`)
    else repo.description ? ok(`GitHub description: "${repo.description}"`) : warn('GitHub repo has no description')
  } catch (e) {
    warn(`GitHub check skipped (${e.message})`)
  }
}
