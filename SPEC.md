# Kindred legacy

Kindred is the public shared-thought party game at
https://kindred-legacy.mistystep.io, not the family-tree app at
kindred.mistystep.io. [USER_STORIES.md](USER_STORIES.md) owns the nine existing
player stories and their open intent. This legacy repair changes no game rules.

## Public guest continuity

A player opening the canonical legacy address can acquire a guest identity,
create or join a room, refresh, and rejoin the same seat. Guest acquisition and
renewal reject missing or foreign origins, including the separate family-tree
address. Continuity cookies remain Secure, HttpOnly, host-only and SameSite=Lax.

An origin/configuration repair preserves the existing backend, signing keys,
player identities and accepted game state. Deployment never takes over the
family-tree address. Backend migration is a separate, unfinished change.
