import { chromium } from "@playwright/test";
const [, , url, out, width = "1440", height = "900", full = "1"] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: +width, height: +height },
});
const logs = [];
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type()))
    logs.push(`${m.type()}: ${m.text()}`);
});
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.screenshot({ path: out, fullPage: full === "1" });
console.log(logs.slice(0, 20).join("\n"));
await browser.close();
