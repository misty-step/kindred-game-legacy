# ADR 0001: Preserve Kindred on the shared Parlor Cloudflare adapter

Status: candidate; production cutover not yet approved by independent review
Date: 2026-10-16

## Decision

Keep the public Worker `kindred` and kindred-legacy.mistystep.io. Do not deploy
onto kindred.mistystep.io: that hostname belongs to another application.

Use the unchanged `@parlor/cloudflare` adapter from Parlor commit
610f57104a9eb7ece5c9b39f8e822c99a17e1596. The second pinned source checkout at
vendor/parlor-cloudflare supplies only integrations/cloudflare; the existing
vendor/parlor core, identity, rooms, React, and web packages remain at their
existing pin. This avoids an unrelated framework upgrade or modifying the
repository's installed version-bound agent guidance. No adapter code is forked.
The migration exercises Kindred's installed Convex 1.45.0 client and functions;
Linejam's 1.42.3 proof is not sufficient evidence for this consumer.

A SQLite-backed KindredBackend Durable Object serves `/backend`. Function
modules, schema, scheduler, crons, guest token validation, and judge code remain
the current game code. The frontend's Convex client points at that same-origin
prefix, and the existing issuer and production guest/continuity keys remain
unchanged so returning guests keep their identity. The backend starts frozen.

Adapter acceptance uses real workerd and deployed consumer journeys, not the
optional in-memory testing shim. The prototype alias of the unchanged suite
exposed early completion in Parlor's `testing.ts:220-225` while a scheduled
action was still running (an explicit event-loop-drain diagnostic passed).
That additional prototype check was retired after the real deployed pair,
crowd, tiebreak, duo and canonical recovery journeys passed. Kindred's existing
unit and Convex checks remain unchanged; no runtime or game rule was forked to
make the shim green. Repairing that shared test helper is separate from this
consumer migration.

The isolated preview uses a separate Worker and Durable Object namespace,
synthetic records, and preview-only signing/admin credentials. It never holds
production data or production guest keys. Administrative paths additionally
require the existing Glass Access identity policy, with the application bearer
key behind it. Public player paths do not acquire Access.

## Custody and cutover

Kaylee authorized a migration-only unarchive, CI deployment, verified live game
and data, then rearchive. Record both archive state changes in the retained
handoff. Game retirement is explicitly not selected. After live cutover, Kaylee
owns the requested seven-day soak and old-Convex retirement follow-up; until
then the old backend remains paused and recoverable.

Before importing any production snapshot: encrypt it with age to an identity
kept only in mirrodin pass, retain it in private R2, verify readback hashes, and
restore it on a non-production target. No plaintext content leaves the protected
restore workspace or appears in logs. Compare canonical counts/checksums and
original IDs across every table. The shared adapter's operator CLI owns the
snapshot/import/export format; do not implement a second converter.

Independent review and exact-head green CI precede production changes. Pause the
old backend, take the consistent final snapshot/delta, reconcile every table,
and make the Cloudflare backend the only writer. Preserve Convex paused/intact.
A rollback must first freeze/export Cloudflare and prove that its accepted writes
restore into Convex; a URL-only rollback is forbidden after new writes.

## Evidence status

This ADR is a design, not migration evidence. Preview, private backup/restore,
review, CI promotion, live browser traffic, canonical record equality, and
rearchive are tracked in the migration handoff and remain unverified until run.
