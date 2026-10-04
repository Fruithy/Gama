import { chromium } from "@playwright/test";
const base = "http://localhost:3100";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await p.goto(base + "/admin", { waitUntil: "networkidle" });
await p.getByLabel("Admin secret").fill("dev-admin");
await p.getByRole("button", { name: "Enter" }).click();
await p.waitForTimeout(1500);
for (const s of (process.argv[2] ?? "overview").split(",")) {
  await p.goto(`${base}/admin?s=${s}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `.data/shots/admin-${s}.png`, fullPage: false });
}
console.log("errors", errors.slice(0, 5));
await b.close();
