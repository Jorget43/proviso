---
name: proviso-schema-change
description: Rules and checklist for any change to Proviso's data model — adding, changing or removing a table, column, enum value, default or relation, writing a migration, or changing what gets synced. Use whenever a change touches the Drizzle schema in packages/core, the legacy prisma/schema.prisma, migrations, or the sync message format.
---

# Changing the Proviso data model

Data lives on every device and syncs as end-to-end encrypted, per-field change messages (`docs/architecture.md`, D2–D3). Old app versions keep running for months and keep sending messages. So a schema change is a protocol change, and these rules are what keep households' data from splitting or getting lost.

## Hard rules

1. **IDs are UUIDs created on the device** (`packages/core/src/ids.ts`). No autoincrement.
   - Ordinary records: `newId()` (UUIDv7).
   - Records with a natural key: `contentId(table, ...key)`, so two devices creating the same row get the same id. **Never add a unique index**: offline devices can't both honour it.
   - Single-row settings tables: the fixed id in `SETTINGS_ID`.
   - Records about a person store `person: 'p1' | 'p2'`, never a name.
2. **Never hard-delete.** Set `deletedAt`; every query filters `deletedAt IS NULL`.
3. **Additive only.**
   - Add new columns as nullable or with a default.
   - Never rename a column, change its type, or reuse a name for a new meaning.
   - To "rename", add a new column, copy across, and leave the old one.
4. **Removing a column takes two releases:** stop reading and writing it in release N, drop it no earlier than N+1, once every supported app version ignores it.
5. **Enum values are only ever added.** Unknown values from newer devices must be stored and shown safely, never crash or be thrown away.
6. **Store facts, not results.** Nothing calculated by `packages/core` (net worth, tax, projections) gets a column.
7. **Every synced value must survive a round trip** through the message format (JSON-safe; dates as ISO strings; money as numbers in dollars as today, never floats-as-strings).
8. **No personal data in the repo.** Defaults, seeds and fixtures use generic names and round numbers (the privacy-scan hook enforces the denylist).

## Checklist

- [ ] Schema edited in `packages/core/src/schema.ts` (Drizzle) — the one definition; `SCHEMA_VERSION` bumped.
- [ ] Migration generated with `npm run db:generate -w @proviso/core` and committed (CI regenerates and fails if anything new appears). Never edit a generated migration.
- [ ] `packages/core/tests/schema.test.ts` passes (migrations build exactly the schema; sync rules hold).
- [ ] Sync: schema version bumped; the merge code handles the new field; a test feeds **messages from the previous schema version** and from a **newer** one (unknown column) and checks nothing is lost.
- [ ] Loaders and core calculations updated; tests in core.
- [ ] Relay unaffected (it stores ciphertext). If table names or permissions changed, update the relay's write-permission map.
- [ ] The export format picks the field up automatically (it validates against the schema); update `apps/web/lib/householdExport.ts` if the NAS app has the data, and its test.

## While the legacy Next.js app is still running

Until `apps/web` retires, it still uses Prisma (`apps/web/prisma/schema.prisma`, migrations in `apps/web/prisma/migrations`, applied by `docker-entrypoint.sh` on the NAS):
- A change that both apps need lands in **both schemas in the same commit**, and `apps/web/tests/householdExport.test.ts` covers the mapping.
- Prisma migrations run against people's live databases on container start: keep them additive too, and test against a scratch copy, never `apps/web/prisma/household.db`.
- Don't add a Prisma-only table for a new feature unless the user agreed that feature stays legacy.
