import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const require = createRequire("/home/agung/revenyu/package.json");
const puppeteer = require("puppeteer");
const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, "portfolio-images");
await mkdir(output, { recursive: true });

const names = [
  "01-cover.png",
  "02-order-tracker.png",
  "03-dashboard.png",
  "04-calendar-automation.png",
  "05-automation-workflow.png",
  "06-working-prototype.png",
];

const browser = await puppeteer.launch({
  headless: true,
  executablePath: "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-gpu", "--allow-file-access-from-files"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 750, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(root, "portfolio-source.html")).href, {
  waitUntil: "networkidle0",
});
await page.evaluate(() => document.fonts.ready);

const slides = await page.$$(".slide");
if (slides.length !== names.length) {
  throw new Error(`Expected ${names.length} slides, found ${slides.length}`);
}

for (let index = 0; index < slides.length; index += 1) {
  await slides[index].screenshot({ path: path.join(output, names[index]) });
}

await page.pdf({
  path: path.join(root, "Cake-Order-Management-Portfolio.pdf"),
  width: "10in",
  height: "7.5in",
  printBackground: true,
  preferCSSPageSize: true,
});

await browser.close();
