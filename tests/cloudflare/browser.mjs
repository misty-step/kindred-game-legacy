import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const output = "/srv/hermes-chief-workspaces/t_6d135dc6/evidence/browser";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const receipt = {
  synthetic: true,
  app: "Next dev + actual workerd backend",
  checks: [],
  traffic: [],
  errors: [],
  screenshots: [],
};
const players = [];
async function shot(page, name) {
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
  receipt.screenshots.push(name);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
}
try {
  for (const [index, name] of [
    "Synthetic Ana",
    "Synthetic Ben",
    "Synthetic Cy",
  ].entries()) {
    const context = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
      viewport:
        index === 0
          ? { width: 1280, height: 900 }
          : { width: 390, height: 844 },
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => receipt.errors.push(e.message));
    page.on("websocket", (ws) => receipt.traffic.push(ws.url()));
    page.on("request", (request) => {
      if (request.url().includes("convex.cloud"))
        receipt.traffic.push(request.url());
    });
    players.push({ name, context, page });
  }
  const [host, guest, third] = players;
  await host.page.goto("http://localhost:3000");
  await shot(host.page, "01-home");
  await host.page.getByRole("button", { name: "Start a game" }).click();
  await host.page.locator("#display-name").fill(host.name);
  await host.page.getByRole("button", { name: "Create room" }).click();
  await host.page.getByRole("heading", { name: "Room code" }).waitFor();
  const code = new URL(host.page.url()).searchParams.get("room");
  assert.match(code, /^[A-Z0-9]{4}$/);
  for (const player of [guest, third]) {
    await player.page.goto(`http://localhost:3000/?room=${code}`);
    await player.page.locator("#join-name").fill(player.name);
    await player.page
      .getByRole("button", { name: "Join", exact: true })
      .click();
    await player.page.getByRole("heading", { name: "Room code" }).waitFor();
  }
  await host.page.getByText("3 people here").waitFor();
  await shot(host.page, "02-lobby-desktop");
  await shot(guest.page, "03-lobby-phone");
  assert.equal(
    await guest.page
      .getByRole("button", { name: "Start game", exact: true })
      .count(),
    0,
  );
  receipt.checks.push(
    "public create+join, desktop+phone lobby and guest has no host-start control",
  );
  const storedBefore = (await guest.context.cookies()).find(
    (cookie) => cookie.name === "kindred-continuity",
  )?.value;
  assert.ok(storedBefore);
  await guest.page.reload();
  // The existing game returns a reload to the prefilled join form, not an
  // automatic room view. Exercise that real consumer path without redesigning it.
  await guest.page.locator("#join-name").waitFor();
  assert.equal(await guest.page.locator("#join-name").inputValue(), guest.name);
  await guest.page.getByRole("button", { name: "Join", exact: true }).click();
  await guest.page.getByRole("heading", { name: "Room code" }).waitFor();
  assert.equal(
    (await guest.context.cookies()).find(
      (cookie) => cookie.name === "kindred-continuity",
    )?.value,
    storedBefore,
  );
  await host.page.getByText("3 people here").waitFor();
  receipt.checks.push(
    "refresh+prefilled rejoin retains continuity cookie and three-member room without duplicate",
  );
  await host.page
    .getByRole("button", { name: "Start game", exact: true })
    .click();
  for (let round = 0; round < 6; round++) {
    if (round === 0)
      await fetch("http://127.0.0.1:43863/unavailable", { method: "POST" });
    for (const [index, player] of players.entries()) {
      await player.page.locator("#answer").waitFor({ timeout: 20_000 });
      await player.page.locator("#answer").fill(index < 2 ? "moon" : "sun");
      await player.page
        .getByRole("button", { name: "Send", exact: true })
        .click();
      if (index === 0) {
        assert.equal(
          (await guest.page.locator("main").innerText()).includes("moon"),
          false,
        );
        if (round === 0) await shot(guest.page, "04-secret-phone");
      }
    }
    if (round === 0) {
      await host.page
        .getByRole("button", { name: "Check again" })
        .waitFor({ timeout: 45_000 });
      await shot(host.page, "05-judge-unavailable");
      await fetch("http://127.0.0.1:43863/recover", { method: "POST" });
      await host.page.getByRole("button", { name: "Check again" }).click();
      receipt.checks.push(
        "synthetic judge503 honestly pending, visible host retry then HTTP recovery",
      );
    }
    const next = host.page.getByRole("button", {
      name: round < 5 ? "Next question" : "See who won",
      exact: true,
    });
    await next.waitFor({ timeout: 30_000 });
    assert.equal(await host.page.locator(".standings li").count(), 1);
    if (round === 0) {
      await shot(host.page, "06-pair-reveal");
      await shot(third.page, "07-single-phone");
    }
    await next.click();
  }
  await host.page
    .getByRole("button", { name: "Share results", exact: true })
    .waitFor();
  await host.page
    .getByRole("heading", { name: "You and Synthetic Ben win.", exact: true })
    .waitFor();
  await host.page
    .getByRole("button", { name: "Share results", exact: true })
    .click();
  const shared = await host.page.evaluate(() => navigator.clipboard.readText());
  assert.match(shared, /Synthetic Ana and Synthetic Ben/);
  assert.doesNotMatch(shared, /moon|sun/);
  receipt.checks.push(
    "spoiler-free shared result names scoring pair, not answer text",
  );
  await shot(host.page, "08-results");
  receipt.checks.push(
    "six three-player rounds; exactly-two pair scores while singleton does not; end results rendered",
  );
  assert.equal(
    receipt.traffic.some((url) => url.includes("convex.cloud")),
    false,
  );
  assert.ok(
    receipt.traffic.some((url) =>
      url.startsWith("ws://127.0.0.1:43861/backend/"),
    ),
  );
  assert.deepEqual(receipt.errors, []);
  receipt.outcome = "pass";
} catch (e) {
  for (const [index, player] of players.entries())
    await shot(player.page, `failure-${index}`);
  receipt.outcome = "fail";
  receipt.failure = e.message;
  throw e;
} finally {
  await writeFile(`${output}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close();
  console.log(JSON.stringify(receipt, null, 2));
}
