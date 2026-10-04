import { chromium } from "@playwright/test";
const base = process.env.BASE ?? "http://localhost:3100";
const slugs = process.argv[2].split(",");
const browser = await chromium.launch();
for (const slug of slugs) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
  await page.goto(`${base}/games/${slug}`, { waitUntil: "networkidle" });
  await page.getByTestId("play-button").click();
  // permission gate (camera/mic) → touch fallback
  await page.waitForTimeout(400);
  const touch = page.getByRole("button", { name: /touch/i });
  if (await touch.count()) await touch.first().click();
  await page.waitForTimeout(1900);
  const box = await page.getByTestId("game-stage").boundingBox();
  await page.screenshot({ path: `.data/shots/smoke-${slug}.png` });
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < Number(process.env.PLAY_MS ?? 4000)) {
    if (await page.getByRole("dialog", { name: "Results" }).count()) break;
    const x = box.x + box.width * (0.2 + Math.random() * 0.6), y = box.y + box.height * (0.3 + Math.random() * 0.5);
    if (i % 3 === 2) { await page.mouse.move(x - 80, y - 60); await page.mouse.down(); await page.mouse.move(x + 80, y + 60, { steps: 8 }); await page.mouse.up(); }
    else await page.mouse.click(x, y);
    if (i === 3 && !(await page.getByRole("dialog", { name: "Results" }).count())) await page.screenshot({ path: `.data/shots/smoke-${slug}.png` });
    i++;
    await page.waitForTimeout(250 + Math.random() * 250);
  }
  const over = await page.getByRole("dialog", { name: "Results" }).count();
  console.log(slug.padEnd(18), over ? "ended" : "running", errors.length ? "ERRORS: " + errors.join(" | ") : "ok");
  await page.close();
}
await browser.close();
