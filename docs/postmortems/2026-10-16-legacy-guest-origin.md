# Legacy guest origin mismatch — 2026-10-16

Status: repair candidate; production recovery is not yet verified.

## Impact and evidence

At 09:08:35 UTC, the legacy game's guest endpoint returned HTTP 403
`SAME_ORIGIN_REQUIRED` for its legitimate browser Origin,
`https://kindred-legacy.mistystep.io`. Independent readback at 10:27:58 UTC
reproduced it. New and refreshing guest sessions could not proceed normally.
The duration and affected player count are unknown. A healthy homepage and
`/api/health` did not establish working guest acquisition. The owner was warned.

## Cause

The serving Worker was bound to the legacy custom domain, but
`PARLOR_APP_ORIGIN` still named the distinct family-tree app. The existing guest
issuer correctly rejected that mismatch. The archived Wrangler route and build
script repeated the wrong hostname. This incident preceded the proposed backend
migration; that migration was not deployed.

## Bounded repair

Correct Wrangler's route and origin to the legacy host. Remove the build
script's redundant origin override: runtime configuration belongs to Wrangler.
Keep the OpenNext entrypoint, Convex backend, public access, existing signing and
continuity keys, and all accepted records unchanged. Regression coverage acquires
a guest with the deployment's actual origin and rejects missing, family-tree
and unrelated origins. An isolated real-Convex browser journey must also prove
create, join and same-identity rejoin on the exact CI artifact before promotion.

## Release and recovery

Use the existing build script and scoped repository CI path; never the backend
migration artifact or runtime-secret bundle. Promotion consumes the successful
exact-head artifact without rebuilding. It preserves Worker secrets and updates
only the release attribution. No backend schema or data transformation occurs.
If the code needs reverting, retain the corrected origin and legacy route: a
bare rollback to the mismatched binding would restore the incident. Any rollback
must keep the current Convex writer and guest keys and preserve accepted writes.

The migration, data custody, production operator Access and rearchive remain
unfinished. Fill in observed deployment identity, live journey and recovery
results after the independent review and incident release; do not infer them
from this document.
