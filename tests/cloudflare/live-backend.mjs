import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { issueGuestToken } from "@parlor/auth/server";
import { ConvexClient, ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { Effect } from "effect";

const base = "http://127.0.0.1:43861/backend";
const client = new ConvexHttpClient(base);
const fixtureKey = "synthetic-loopback-admin-not-a-real-secret-00000000";
const ref = (name) => makeFunctionReference(name);
const checks = [];
async function admin(route, body) {
  const response = await fetch(`${base}/admin/${route}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${fixtureKey}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert.equal(response.status, 200);
  return response.json();
}
async function token(guestId) {
  return (
    await Effect.runPromise(
      issueGuestToken({
        keyId: "loopback",
        secret: new Uint8Array(32).fill(0x4b),
        audience: "kindred",
        guestId,
        lifetimeMs: 60 * 60_000,
      }),
    )
  ).token;
}
const stamp = Date.now();
const tokens = await Promise.all(
  ["host", "guest", "outsider"].map((name) => token(`${name}-${stamp}`)),
);
const [hostToken, guestToken, outsiderToken] = tokens;
const mutation = (name, args) => client.mutation(ref(name), args);
const view = (roomId, guestToken = hostToken) =>
  client.query(ref("game:view"), { roomId, guestToken });
const denied = await fetch(`${base}/admin/status`);
assert.equal(denied.status, 401);
checks.push("anonymous admin denied401");
await admin("freeze", { frozen: false });
assert.equal((await admin("status")).writesFrozen, false);
const room = await mutation("rooms:createRoom", {
  displayName: "Synthetic Host",
  guestToken: hostToken,
});
const join = await mutation("rooms:joinRoom", {
  code: room.code,
  displayName: "Synthetic Guest",
  guestToken,
});
assert.equal(join.ok, true);
assert.equal(join.roomId, room.roomId);
await assert.rejects(
  mutation("game:start", { roomId: room.roomId, guestToken }),
  /HOST_REQUIRED/,
);
await mutation("rooms:createRoom", {
  displayName: "Synthetic Outsider",
  guestToken: outsiderToken,
});
await assert.rejects(view(room.roomId, outsiderToken), /NOT_A_ROOM_MEMBER/);
await assert.rejects(
  mutation("rooms:createRoom", {
    displayName: "Denied",
    guestToken: "invalid",
  }),
);
checks.push("room create+join; nonhost, outsider and invalid guest denied");
const rejoin = await mutation("rooms:joinRoom", {
  code: room.code,
  displayName: "Synthetic Guest",
  guestToken,
});
assert.equal(rejoin.playerId, join.playerId);
assert.equal(rejoin.seatIndex, join.seatIndex);
checks.push("same identity rejoin retains player+seat");
const ws = new ConvexClient(base);
let updates = 0;
const unsubscribe = ws.onUpdate(
  ref("game:view"),
  { roomId: room.roomId, guestToken },
  () => {
    updates++;
  },
);
const matchId = await mutation("game:start", {
  roomId: room.roomId,
  guestToken: hostToken,
});
for (let index = 0; index < 6; index++) {
  let state = await view(room.roomId);
  assert.equal(state.match.round.index, index);
  const roundId = state.match.round.id;
  const secretText = `synthetic-private-${stamp}-${index}`;
  await mutation("game:submitAnswer", {
    roomId: room.roomId,
    matchId,
    roundId,
    guestToken: hostToken,
    text: secretText,
  });
  const hidden = await view(room.roomId, guestToken);
  assert.equal(hidden.match.round.myAnswer, null);
  assert.equal(hidden.match.reveal, null);
  assert.equal(JSON.stringify(hidden).includes(secretText), false);
  await assert.rejects(
    mutation("game:submitAnswer", {
      roomId: room.roomId,
      matchId,
      roundId,
      guestToken: hostToken,
      text: secretText,
    }),
    /ANSWER_ALREADY_SUBMITTED/,
  );
  await mutation("game:submitAnswer", {
    roomId: room.roomId,
    matchId,
    roundId,
    guestToken,
    text: secretText,
  });
  for (let attempt = 0; attempt < 80; attempt++) {
    state = await view(room.roomId);
    if (state.match.round.status === "revealed") break;
    await delay(50);
  }
  assert.equal(state.match.round.status, "revealed");
  assert.equal(state.match.standings[0].total, index + 1);
  await mutation("game:advance", {
    roomId: room.roomId,
    matchId,
    guestToken: hostToken,
  });
}
assert.equal((await view(room.roomId)).match.status, "completed");
checks.push(
  "six actual alarm/action rounds; no private pre-reveal answer; duplicate rejected; pair score6; completed",
);
await delay(100);
assert.ok(updates > 0);
unsubscribe();
await ws.close();
checks.push("Convex1.45 WebSocket subscription receives real updates");
await admin("freeze", { frozen: true });
const frozen = await admin("stats");
await assert.rejects(
  mutation("rooms:createRoom", {
    displayName: "Frozen",
    guestToken: hostToken,
  }),
);
assert.deepEqual((await admin("stats")).tables, frozen.tables);
await admin("freeze", { frozen: false });
checks.push(
  "freeze denies writes with unchanged canonical table digests; unfreeze recovers",
);
console.log(
  JSON.stringify(
    {
      outcome: "pass",
      backend: base,
      checks,
      updates,
      roomId: room.roomId,
      playerId: join.playerId,
      synthetic: true,
    },
    null,
    2,
  ),
);
