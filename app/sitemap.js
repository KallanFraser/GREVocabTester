/** @format */
// Next.js file-based convention. Emits /out/sitemap.xml at build time
// under output: "export".

// Required under output: "export" — emit a static sitemap.xml at build time.
export const dynamic = "force-static";

const BASE = "https://grevocabtester.com";

export default function sitemap() {
	const lastModified = new Date();
	return [
		{
			url: BASE,
			lastModified,
			changeFrequency: "weekly",
			priority: 1.0,
		},
		{
			url: `${BASE}/wordpacks`,
			lastModified,
			changeFrequency: "weekly",
			priority: 0.8,
		},
		{
			url: `${BASE}/play/test`,
			lastModified,
			changeFrequency: "monthly",
			priority: 0.7,
		},
		{
			url: `${BASE}/play/practice`,
			lastModified,
			changeFrequency: "monthly",
			priority: 0.6,
		},
		{
			url: `${BASE}/play/learn`,
			lastModified,
			changeFrequency: "monthly",
			priority: 0.6,
		},
	];
}
