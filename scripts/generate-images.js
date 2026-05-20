/** @format */
/* eslint-disable no-console */

// scripts/generate-images.js
//
// Generates purpose-sized icon/social/footer/banner assets from the two
// large source PNGs in /public/images. Idempotent — re-running overwrites
// outputs and leaves the source PNGs untouched.
//
// Run: npm run generate:images   (or: node scripts/generate-images.js)

const path = require("path");
const fs = require("fs/promises");
const sharp = require("sharp");
const pngToIco = require("png-to-ico");

const ROOT = path.resolve(__dirname, "..");
const SRC_LOGO = path.join(ROOT, "public", "images", "GREWebsiteLogo.png");
const SRC_BANNER = path.join(ROOT, "public", "images", "GRETesterBanner.png");

// OG card background — matches --bg-deep / `#050505` used by the landing page
// (styles/home.css, #home-landing.coral-v1 { --bg-deep: #050505 }).
const OG_BG = { r: 5, g: 5, b: 5, alpha: 1 };
const OG_BG_HEX = "#050505";

async function ensureFile(p) {
	try {
		await fs.access(p);
	} catch {
		throw new Error(`Source image not found: ${path.relative(ROOT, p)}`);
	}
}

async function write(outPath, buf) {
	await fs.mkdir(path.dirname(outPath), { recursive: true });
	await fs.writeFile(outPath, buf);
	const rel = path.relative(ROOT, outPath).replaceAll("\\", "/");
	const kib = (buf.length / 1024).toFixed(1);
	console.log(`  + ${rel}  (${kib} KiB)`);
}

async function generate() {
	console.log("generate-images: reading sources");
	await ensureFile(SRC_LOGO);
	await ensureFile(SRC_BANNER);
	console.log(`  - ${path.relative(ROOT, SRC_LOGO).replaceAll("\\", "/")}`);
	console.log(`  - ${path.relative(ROOT, SRC_BANNER).replaceAll("\\", "/")}`);

	// 1) favicon.ico — multi-res 16/32/48 from the logo
	console.log("\n[1/6] favicon.ico (16,32,48)");
	const icoSizes = [16, 32, 48];
	const icoPngBufs = await Promise.all(
		icoSizes.map((s) =>
			sharp(SRC_LOGO)
				.resize(s, s, {
					fit: "contain",
					background: { r: 0, g: 0, b: 0, alpha: 0 },
				})
				.png()
				.toBuffer()
		)
	);
	const icoBuf = await pngToIco(icoPngBufs);
	await write(path.join(ROOT, "public", "favicon.ico"), icoBuf);

	// 2) apple-touch-icon.png — Apple's spec is 180x180
	console.log("\n[2/6] apple-touch-icon.png (180x180)");
	const apple = await sharp(SRC_LOGO)
		.resize(180, 180, {
			fit: "contain",
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		})
		.png({ compressionLevel: 9 })
		.toBuffer();
	await write(path.join(ROOT, "public", "apple-touch-icon.png"), apple);

	// 3) logo-128.webp — 128px square = 2x DPR headroom for the 40px footer logo
	console.log("\n[3/6] logo-128.webp (128x128, q82)");
	const logoWebp = await sharp(SRC_LOGO)
		.resize(128, 128, {
			fit: "contain",
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		})
		.webp({ quality: 82 })
		.toBuffer();
	await write(path.join(ROOT, "public", "images", "logo-128.webp"), logoWebp);

	// 4) og-image.png — proper 1200x630 social card. Logo centered on flat
	// brand-dark background (#050505) since the source logo is square and OG is 1.91:1.
	console.log(`\n[4/6] og-image.png (1200x630, bg ${OG_BG_HEX})`);
	const ogLogo = await sharp(SRC_LOGO)
		.resize(520, 520, {
			fit: "contain",
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		})
		.png()
		.toBuffer();
	const og = await sharp({
		create: {
			width: 1200,
			height: 630,
			channels: 4,
			background: OG_BG,
		},
	})
		.composite([{ input: ogLogo, gravity: "center" }])
		.png({ compressionLevel: 9 })
		.toBuffer();
	await write(path.join(ROOT, "public", "images", "og-image.png"), og);

	// 5) GRETesterBanner.webp — desktop banner, original aspect (1200x300)
	console.log("\n[5/6] GRETesterBanner.webp (1200x300, q80)");
	const banner = await sharp(SRC_BANNER)
		.resize(1200, 300, { fit: "cover" })
		.webp({ quality: 80 })
		.toBuffer();
	await write(path.join(ROOT, "public", "images", "GRETesterBanner.webp"), banner);

	// 6) GRETesterBanner-mobile.webp — mobile srcset variant (600x150)
	console.log("\n[6/6] GRETesterBanner-mobile.webp (600x150, q80)");
	const bannerMobile = await sharp(SRC_BANNER)
		.resize(600, 150, { fit: "cover" })
		.webp({ quality: 80 })
		.toBuffer();
	await write(path.join(ROOT, "public", "images", "GRETesterBanner-mobile.webp"), bannerMobile);

	console.log("\ngenerate-images: done.");
}

generate().catch((err) => {
	console.error("\ngenerate-images failed:", err && err.stack ? err.stack : err);
	process.exit(1);
});
