// Renders scene.html (a 3D shader painting) to assets/landscape.jpg with a headless browser.
//   node scripts/landscape/render.mjs [width]
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const width = +(process.argv[2] || 2560);
const out = process.argv[3] || new URL("../../assets/landscape.jpg", import.meta.url).pathname;
mkdirSync(new URL("../../assets/", import.meta.url), { recursive: true });

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
page.on("pageerror", (e) => { console.error(e.message); process.exit(1); });
await page.goto(new URL(`./scene.html?w=${width}`, import.meta.url).href);
await page.waitForFunction("window.ready");
const { W, H } = await page.evaluate("window.size");

const tile = 160;
const total = Math.ceil(W / tile) * Math.ceil(H / tile);
let done = 0;
for (let y = 0; y < H; y += tile) {
  for (let x = 0; x < W; x += tile) {
    await page.evaluate(([x, y, t]) => window.renderTile(x, y, t, t), [x, y, tile]);
    if (++done % 20 === 0) process.stdout.write(`\r${Math.round((done / total) * 100)}%`);
  }
}
const data = await page.evaluate(() => document.getElementById("c").toDataURL("image/jpeg", 0.86));
writeFileSync(out, Buffer.from(data.split(",")[1], "base64"));
await browser.close();
console.log(`\nSaved ${W}x${H} image`);
