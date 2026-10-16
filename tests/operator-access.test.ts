import assert from "node:assert/strict";
import test from "node:test";
import { operatorAllowed } from "../cloudflare/access.ts";

test("operator boundary verifies real RSA signatures and exact human/machine identities", async () => {
  const issuer = "https://kindred-access.invalid";
  const audience = "kindred-test-audience";
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const jwk = {
    ...(await crypto.subtle.exportKey("jwk", pair.publicKey)),
    kid: "fixture",
    alg: "RS256",
  };
  const previous = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(String(url), `${issuer}/cdn-cgi/access/certs`);
    return Response.json({ keys: [jwk] });
  };
  const config = JSON.stringify({
    issuer,
    audience,
    humans: ["owner@example.test"],
    machine: { kind: "migration-verifier", clientId: "fixture-client.access" },
  });
  const now = Math.floor(Date.now() / 1000);
  const base = {
    iss: issuer,
    aud: [audience],
    sub: "human-subject",
    email: "owner@example.test",
    iat: now,
    exp: now + 60,
  };
  async function signed(overrides: Record<string, unknown>) {
    const encode = (v: unknown) =>
      Buffer.from(JSON.stringify(v)).toString("base64url");
    const payload = `${encode({ alg: "RS256", kid: "fixture" })}.${encode({ ...base, ...overrides })}`;
    const sig = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      pair.privateKey,
      Buffer.from(payload),
    );
    return `${payload}.${Buffer.from(sig).toString("base64url")}`;
  }
  async function allowed(overrides: Record<string, unknown>, raw = config) {
    return operatorAllowed(
      new Request("https://game.invalid/backend/admin/status", {
        headers: { "Cf-Access-Jwt-Assertion": await signed(overrides) },
      }),
      raw,
    );
  }
  try {
    assert.equal(await allowed({}), true);
    assert.equal(
      await allowed({
        sub: "",
        common_name: "fixture-client.access",
        email: undefined,
      }),
      true,
    );
    for (const claims of [
      { email: "stranger@example.test" },
      { sub: "", common_name: "unknown.access" },
      { sub: "", common_name: undefined },
      { sub: "", common_name: undefined, email: "owner@example.test" },
      { aud: ["wrong"] },
      { iss: "https://wrong.invalid" },
      { exp: now - 10 },
      { exp: undefined },
      { exp: "never" },
      { nbf: now + 60 },
      { iat: now + 60 },
      { iat: undefined },
    ])
      assert.equal(await allowed(claims), false);
    assert.equal(
      await allowed(
        {},
        JSON.stringify({
          issuer,
          audience,
          humans: ["owner@example.test"],
          machine: { kind: "unknown", clientId: "fixture-client.access" },
        }),
      ),
      false,
    );
    const assertion = await signed({});
    const tampered = assertion.slice(0, -10) + "AAAAAAAAAA";
    assert.equal(
      await operatorAllowed(
        new Request("https://game.invalid/backend/admin/status", {
          headers: { "Cf-Access-Jwt-Assertion": tampered },
        }),
        config,
      ),
      false,
    );
    assert.equal(
      await operatorAllowed(
        new Request("https://game.invalid/backend/admin/status"),
        config,
      ),
      false,
    );
  } finally {
    globalThis.fetch = previous;
  }
});
