import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { POST } from "../app/api/guest/route.ts";

// This config is JSON with trailing commas, without comments.
const config = JSON.parse(
  readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8").replace(
    /,\s*([}\]])/g,
    "$1",
  ),
);

test("canonical deployment route accepts guests and refuses foreign origins", async () => {
  const origin = "https://kindred-legacy.mistystep.io";
  assert.equal(config.vars.PARLOR_APP_ORIGIN, origin);
  assert.deepEqual(config.routes, [
    { pattern: new URL(origin).host, custom_domain: true },
  ]);
  assert.doesNotMatch(
    readFileSync(
      new URL("../scripts/deploy-cloudflare.mjs", import.meta.url),
      "utf8",
    ),
    /PARLOR_APP_ORIGIN\s*:/,
  );
  const saved = { ...process.env };
  Object.assign(process.env, {
    ...config.vars,
    NODE_ENV: "production",
    KINDRED_LOCAL: "false",
    PARLOR_GUEST_TOKEN_KEYS: JSON.stringify({
      activeKeyId: "synthetic",
      keys: { synthetic: Buffer.alloc(32, 0x41).toString("base64url") },
    }),
    PARLOR_CONTINUITY_SECRET: Buffer.alloc(32, 0x42).toString("base64url"),
  });
  const acquire = (requestOrigin: string | null) =>
    POST(
      new Request(`${origin}/api/guest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(requestOrigin ? { Origin: requestOrigin } : {}),
        },
        body: JSON.stringify({ mode: "acquire" }),
      }),
    );
  try {
    const accepted = await acquire(origin);
    assert.equal(accepted.status, 200);
    const cookie = accepted.headers.get("set-cookie") ?? "";
    assert.match(cookie, /^__Host-kindred-continuity=/);
    assert.match(cookie, /; Secure/);
    assert.match(cookie, /; HttpOnly/);
    assert.match(cookie, /; SameSite=Lax/);
    assert.doesNotMatch(cookie, /; Domain=/i);
    for (const denied of [
      null,
      "https://kindred.mistystep.io",
      "https://wrong-origin.example.invalid",
    ]) {
      const response = await acquire(denied);
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { code: "SAME_ORIGIN_REQUIRED" });
      assert.equal(response.headers.has("set-cookie"), false);
    }
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in saved)) delete process.env[key];
    }
    Object.assign(process.env, saved);
  }
});
