# Legacy guest origin mismatch — 2026-10-16

Status: origin incident recovered at 10:53 UTC; backend migration remains unfinished.

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

## Observed recovery

Independent review approved `dc9f597cf2a3234a3535db6353db881bdf389875` after
the Node 24.20.0/pnpm 11.25.0 canonical checks (42 unit and four Convex tests)
and real isolated replay of the downloaded CI artifact. The replay covered
create/join, same-identity rejoin, origin denial, actual socket recovery and
accepted-answer secrecy. The captured old issuer, with corrected origin and the
same synthetic keys, preserved the guest, seat, match, round and accepted answer.
This was issuer compatibility, not a full old-assets or production rollback.

The reviewed commit fast-forwarded to master at 10:48:44 UTC. Repository CI run
[`38889674262`](https://github.com/misty-step/kindred-game-legacy/actions/runs/38889674262)
promoted the verified artifact from push run `38888087733` without rebuilding.
The final Worker version is `ac745932-f25f-4669-8d3d-2fcb568844db` (100%), created
at 10:50:49 UTC. GET-only readback at 10:51 UTC matched the tested Worker SHA-256
`ba1b90e3c9fcaf7a5a4d60cc48e8c5f5d4ddd666be47fd77e40c7a6f09023a87` and exact
release. Binding names/types and the legacy custom domain were unchanged;
the corrected origin was present. No signing-key replacement, backend import,
Convex pause, migration secret bundle or Access change occurred. The separate
family-tree homepage remained HTTP 200 with an unchanged response checksum.

Direct production browser checks at 10:52:51–10:53:00 UTC passed guest acquisition,
create/join, same-cookie-and-identity refresh/rejoin, explicit refresh,
missing/family-tree/foreign-origin HTTP 403 refusal, offline/online rejoin and
game start on desktop and phone. Final run: zero page/console errors or failed
requests; real screenshots inspected. Only owned synthetic rooms were exercised;
no unrelated records were queried. Two earlier browser attempts stopped on
Chromium `ERR_NETWORK_CHANGED`/error-page navigation; their failure receipts were
retained. The final passing run needed no retry. Full game/judge completion was
not part of this bounded repair, and traffic still correctly reaches Convex.

The postmortem update is documentation only; the deployed runtime remains the
reviewed `dc9f597` artifact. Migration custody, production operator Access,
backend cutover/live acceptance and rearchive remain unfinished.
