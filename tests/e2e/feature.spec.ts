import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("both peers see the same drawn fortune (deterministic via fairRng)", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(500);

    await a.getByPlaceholder("add a fortune…").fill("you will ship today");
    await a.getByRole("button", { name: "add fortune", exact: true }).click();
    await b.getByPlaceholder("add a fortune…").fill("the bug is in main.tsx");
    await b.getByRole("button", { name: "add fortune", exact: true }).click();
    await b.waitForTimeout(500);

    await a.getByRole("button", { name: "crack a cookie", exact: true }).click();
    await b.waitForTimeout(500);

    const cardA = (await a.locator(".fortune-card").innerText()).trim();
    const cardB = (await b.locator(".fortune-card").innerText()).trim();
    if (cardA !== cardB) throw new Error("disagree: " + cardA + " vs " + cardB);
    // and it should be one of the two added
    if (!cardA.includes("you will ship today") && !cardA.includes("the bug is in main.tsx")) {
      throw new Error("unexpected draw: " + cardA);
    }
    expect(cardA).toBe(cardB);
  } finally {
    await cleanup();
  }
});

// Load-bearing test: the advertised "fair deterministic draw. Every peer agrees
// on the same cookie." must hold ACROSS ROUNDS and from EITHER peer cracking.
// With a 6-fortune pool, a non-deterministic (per-peer-random) draw would
// disagree with overwhelming probability. We crack three times, alternating
// which peer triggers the crack, and after each crack assert BOTH peers show the
// SAME card AND the SAME shared round counter. This fails if the draw is local
// instead of seeded from the shared salts, or if the round map doesn't sync.
test("multi-round deterministic draw stays in agreement, either peer can crack", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(500);

    const pool = [
      "fortune one is here",
      "fortune two is here",
      "fortune three is here",
      "fortune four is here",
      "fortune five is here",
      "fortune six is here",
    ];
    // Split the pool across both peers so both contribute fairRng salts.
    for (let i = 0; i < pool.length; i++) {
      const peer = i % 2 === 0 ? a : b;
      await peer.getByPlaceholder("add a fortune…").fill(pool[i]!);
      await peer.getByRole("button", { name: "add fortune", exact: true }).click();
    }
    // Both peers must converge on the full pool before any crack.
    await expect(a.locator(".fortune-chip")).toHaveCount(pool.length);
    await expect(b.locator(".fortune-chip")).toHaveCount(pool.length);

    // Alternate who cracks each round: A, then B, then A.
    const crackers = [a, b, a];
    for (let round = 1; round <= crackers.length; round++) {
      await crackers[round - 1]!.getByRole("button", {
        name: "crack a cookie",
        exact: true,
      }).click();

      // The shared round counter must reach this round on BOTH peers.
      await expect(a.locator(".fortune-status")).toContainText(`round ${round}`);
      await expect(b.locator(".fortune-status")).toContainText(`round ${round}`);

      const cardA = (await a.locator(".fortune-card").innerText()).trim();
      const cardB = (await b.locator(".fortune-card").innerText()).trim();
      // Same cookie on both peers …
      expect(cardA, `round ${round} disagreement`).toBe(cardB);
      // … and it's a real fortune from the pool, not the empty placeholder.
      expect(pool.some((p) => cardA.includes(p))).toBe(true);
    }
  } finally {
    await cleanup();
  }
});
