import { chromium } from "@playwright/test";
const base = process.env.BASE ?? "http://localhost:3100";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
for (const path of (process.argv[2] ?? "/").split(",")) {
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.screenshot({ path: `.data/shots/${path.replace(/\W+/g, "_") || "home"}.png`, fullPage: process.argv[3] === "full" });
}
console.log("errors:", errors.slice(0, 10));
await browser.close();
