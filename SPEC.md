# Kindred legacy

Kindred is the public shared-thought party game at
https://kindred-legacy.mistystep.io. It is not the family-tree application at
kindred.mistystep.io. This migration preserves the existing game, not the
unshipped reimagination designs.

## Player stories

[USER_STORIES.md](USER_STORIES.md) owns US-001 through US-009: joining,
understanding the pair rule, secret answers, simultaneous reveal, pair scoring,
six-question results and one tiebreak, two-player play, honest judge outages,
and spoiler-free sharing. Those stories and their existing intent are unchanged.
Their historical pending-operator-review note remains explicit; this migration
does not settle new game-design questions.

## US-010 Keep the same game through a backend move

A returning player retains their identity, room, seat, answers, retained judge
verdicts, and results when the application backend changes hosts. Refreshing or
reconnecting does not create another identity or repeat an accepted mutation.

- Public players still join without Cloudflare Access or an account.
- Invalid credentials and outsiders cannot read room answers or act as a host.
- Every stored record keeps its identifier, creation time, and content. Canonical
  content checksums, not storage-file checksums, prove the move.
- There is only one writable backend. Final migration includes all writes
  accepted before the old backend freezes. Recovery preserves every subsequently
  accepted write.
- A judge outage keeps the round honestly pending; host retry and retained
  verdicts continue to work after a restart.
- The old backend remains recoverable until the Cloudflare game and its data
  have passed live verification. Retirement is not authorized.

## Operator boundary

Snapshot and restore endpoints are not player APIs. Anonymous, malformed, and
unrecognized operator identities are denied. Private player content and signing
credentials never appear in screenshots, telemetry, or public CI artifacts.

## Open intent

No new features or visual changes are authorized. Any pre-existing discrepancy
between the nine historical stories and current behavior is recorded separately,
not silently redesigned as part of this migration.
