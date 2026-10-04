import { chromium } from "@playwright/test";
const base = process.env.BASE ?? "http://localhost:3100";
const slug = process.argv[2] ?? "stack-up";
const tapEvery = Number(process.argv[3] ?? 700);
const maxMs = Number(process.argv[4] ?? 30000);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`${base}/games/${slug}`, { waitUntil: "networkidle" });
await page.getByTestId("play-button").click();
await page.waitForTimeout(700);
await page.screenshot({ path: `.data/shots/${slug}-countdown.png` });
await page.waitForTimeout(1200);
const stage = page.getByTestId("game-stage");
const box = await stage.boundingBox();
const t0 = Date.now();
let shot = false;
while (Date.now() - t0 < maxMs) {
  if (await page.getByRole("dialog", { name: "Results" }).count()) break;
  const x = box.x + box.width * (0.3 + Math.random() * 0.4), y = box.y + box.height * (0.35 + Math.random() * 0.4);
  await page.mouse.click(x, y);
  if (!shot && Date.now() - t0 > Number(process.env.SHOT_AT ?? 2500)) { await page.screenshot({ path: `.data/shots/${slug}-play.png` }); shot = true; }
  await page.waitForTimeout(tapEvery);
}
await page.waitForTimeout(2500);
await page.screenshot({ path: `.data/shots/${slug}-result.png` });
console.log("result dialog:", await page.getByRole("dialog", { name: "Results" }).count(), "errors:", errors.slice(0, 8));
await browser.close();
