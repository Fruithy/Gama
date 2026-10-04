import { expect, test, type Page } from "@playwright/test";

/** Mash the stage until the results dialog appears (Tap Rush lasts 10 s). */
async function mashUntilResults(page: Page, maxMs = 20_000, intervalMs = 90) {
  const stage = page.getByTestId("game-stage");
  const box = (await stage.boundingBox())!;
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (await page.getByRole("dialog", { name: "Results" }).isVisible().catch(() => false)) return;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.55);
    await page.waitForTimeout(intervalMs);
  }
  await expect(page.getByRole("dialog", { name: "Results" })).toBeVisible();
}

test("homepage → discover → play → rank → retry → leaderboard → challenge → friend plays challenge", async ({ page, browser }) => {
  // Homepage is playable in the first viewport.
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("HOW HIGH CAN YOU");
  await expect(page.getByText("Daily Challenge").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /PLAY NOW/i })).toBeInViewport();

  // Discover: search and open a game.
  await page.goto("/games");
  await page.getByLabel("Search games").fill("tap rush");
  await page.getByRole("link", { name: /Tap Rush/ }).first().click();
  await expect(page).toHaveURL(/\/games\/tap-rush/);
  await expect(page.getByRole("heading", { name: "Tap Rush" }).first()).toBeVisible();

  // Play: countdown → HUD → results with a world rank.
  await page.getByTestId("play-button").click();
  await expect(page.getByTestId("hud-score")).toBeVisible();
  await page.waitForTimeout(1600); // 3-2-1-GO
  await mashUntilResults(page);
  const results = page.getByRole("dialog", { name: "Results" });
  await expect(results.getByRole("heading")).toContainText("IN THE WORLD");
  await expect(results.getByText(/WORLD RECORD/)).toBeVisible();

  // Challenge a friend: creates a share link.
  await results.getByRole("button", { name: /Challenge/ }).click();
  const sheet = page.getByRole("dialog", { name: "Challenge a friend" });
  await expect(sheet).toBeVisible();
  const challengeUrl = (await sheet.locator("text=/\\/challenge\\//").first().textContent())!.trim();
  expect(challengeUrl).toMatch(/\/challenge\/[2-9a-zA-Z]{10}$/);
  await sheet.getByRole("button", { name: "Close" }).click();

  // Retry is one tap and restarts instantly.
  await page.waitForTimeout(700);
  await results.getByRole("button", { name: /Retry/ }).click();
  await expect(results).toBeHidden();
  await expect(page.getByTestId("hud-score")).toBeVisible();
  await page.getByRole("button", { name: "Exit game" }).click();

  // Leaderboard shows the player.
  await page.goto("/games/tap-rush/leaderboard");
  await expect(page.locator("li[aria-current='true']")).toBeVisible();

  // A different person opens the challenge link — no account needed.
  const friend = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const fp = await friend.newPage();
  await fp.goto(new URL(challengeUrl).pathname);
  await expect(fp.getByText("Can you beat it?")).toBeVisible();
  await fp.getByTestId("play-challenge").click();
  await expect(fp).toHaveURL(/challenge=/);
  await fp.getByRole("button", { name: /Tap to start/ }).click();
  await fp.waitForTimeout(1600);
  await mashUntilResults(fp, 20_000, 400); // deliberately slow: should lose
  await expect(fp.getByRole("dialog", { name: "Results" }).getByRole("heading")).toContainText(/YOU (WON|LOST BY)|DEAD HEAT/);
  await expect(fp.getByRole("button", { name: /Rematch/ })).toBeVisible();
  await friend.close();
});

test("reaction flash: tapping early voids the run (lower-is-better games never rank incomplete runs)", async ({ page }) => {
  await page.goto("/games/reaction-flash");
  await page.getByTestId("play-button").click();
  await page.waitForTimeout(1500);
  const box = (await page.getByTestId("game-stage").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); // during WAIT…
  const results = page.getByRole("dialog", { name: "Results" });
  await expect(results.getByRole("heading")).toHaveText("TOO EARLY");
  await expect(results.getByText(/don't count/)).toBeVisible();
});

test("daily, records, profile and admin are reachable", async ({ page }) => {
  await page.goto("/daily");
  await expect(page.getByText("Daily Challenge").first()).toBeVisible();
  await expect(page.getByText(/Next challenge in/i)).toBeVisible();
  await page.goto("/records");
  await expect(page.getByRole("heading", { name: /Record/i }).first()).toBeVisible();
  await page.goto("/me");
  await expect(page.getByText(/Preferences/)).toBeVisible();
  await page.goto("/admin");
  await page.getByLabel("Admin secret").fill("e2e-admin-secret");
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.getByText(/Plays today/i)).toBeVisible();
});

test("SEO + PWA endpoints", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  expect((await manifest.json()).display).toBe("standalone");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/games/stack-up");
  const page = await (await request.get("/games/stack-up")).text();
  expect(page).toContain('"@type":"VideoGame"');
  expect(page).toContain('rel="canonical"');
  expect((await request.get("/games/stack-up/opengraph-image")).headers()["content-type"]).toContain("image/png");
  expect((await request.get("/art/stack-up.svg")).headers()["content-type"]).toContain("image/svg+xml");
  expect((await request.get("/sw.js")).ok()).toBe(true);
});
