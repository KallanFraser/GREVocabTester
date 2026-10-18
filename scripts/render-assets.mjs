// Renders the OG image and PWA icons with headless Edge via Playwright.
// sharp does not load on win32-arm64, and no dependency is added: run with
//   npm run assets:render
// which uses `npx -p playwright`. Overwrites outputs; safe to re-run.
import { createRequire } from "node:module";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, delimiter } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Inline as a data URI: setContent pages are about:blank and cannot load file:// URLs.
const logoUrl = `data:image/png;base64,${readFileSync(join(root, "public/images/GREWebsiteLogo.png")).toString("base64")}`;
const home = JSON.parse(readFileSync(join(root, "src/data/home.json"), "utf8"));
const words = Number(home.words).toLocaleString("en-US");

// Locate playwright in the npx cache (npx puts its node_modules/.bin on PATH).
function loadPlaywright() {
	for (const dir of process.env.PATH.split(delimiter)) {
		const base = join(dir, "..");
		if (existsSync(join(base, "playwright", "package.json"))) {
			return createRequire(join(base, "x.js"))("playwright");
		}
	}
	return createRequire(import.meta.url)("playwright");
}

const CORAL = "#ea5746";
const FONT = `'Inter','Segoe UI',system-ui,sans-serif`;

const ogHtml = `<html><body style="margin:0;width:1200px;height:630px;background:#050505;font-family:${FONT};color:#fff;position:relative;overflow:hidden">
<div style="position:absolute;left:0;top:0;width:14px;height:630px;background:${CORAL}"></div>
<div style="position:absolute;right:-180px;top:-180px;width:560px;height:560px;border-radius:50%;background:radial-gradient(circle,rgba(234,87,70,.35),rgba(234,87,70,0) 70%)"></div>
<img src="${logoUrl}" style="position:absolute;right:70px;top:175px;width:280px;height:280px">
<div style="position:absolute;left:90px;top:150px">
  <div style="font-size:72px;font-weight:800;letter-spacing:-1.5px;line-height:1.05;white-space:nowrap">GRE <span style="color:${CORAL}">|</span> Vocab Tester</div>
  <div style="font-size:36px;color:#c9c9c9;margin-top:28px;max-width:640px;line-height:1.3">Free GRE vocabulary practice built around active recall.</div>
  <div style="margin-top:48px;display:inline-block;padding:14px 28px;border:2px solid ${CORAL};border-radius:999px;font-size:30px;font-weight:700;color:${CORAL}">${words} words</div>
</div>
<div style="position:absolute;left:90px;bottom:48px;font-size:26px;color:#8a8a8a">grevocabtester.com</div>
</body></html>`;

const iconHtml = (size, scale, bg) => `<html><body style="margin:0;width:${size}px;height:${size}px;background:${bg};display:flex;align-items:center;justify-content:center">
<img src="${logoUrl}" style="width:${size * scale}px;height:${size * scale}px"></body></html>`;

const jobs = [
	{ out: "public/images/og-image.png", w: 1200, h: 630, html: ogHtml },
	{ out: "public/icons/icon-192.png", w: 192, h: 192, html: iconHtml(192, 1, "transparent"), transparent: true },
	{ out: "public/icons/icon-512.png", w: 512, h: 512, html: iconHtml(512, 1, "transparent"), transparent: true },
	// Maskable: full-bleed coral, logo inside the 80% safe zone.
	{ out: "public/icons/icon-maskable-512.png", w: 512, h: 512, html: iconHtml(512, 0.7, "#f0523a") },
];

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ channel: "msedge" });
try {
	for (const j of jobs) {
		const page = await browser.newPage({ viewport: { width: j.w, height: j.h } });
		await page.setContent(j.html, { waitUntil: "load" });
		await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
		const path = join(root, j.out);
		mkdirSync(dirname(path), { recursive: true });
		await page.screenshot({ path, omitBackground: !!j.transparent });
		await page.close();
		console.log("wrote", j.out);
	}
} finally {
	await browser.close();
}
