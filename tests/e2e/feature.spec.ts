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
