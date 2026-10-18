/** @format */
// Next.js file-based convention. Emits /out/sitemap.xml at build time
// under output: "export".

// Required under output: "export": emit a static sitemap.xml at build time.
export const dynamic = "force-static";

const BASE = "https://grevocabtester.com";

// Every study mode, in the order the home page lists them.
const PLAY_ROUTES = ["test", "practice", "learn", "cards", "review", "context"];

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
		...PLAY_ROUTES.map((route) => ({
			url: `${BASE}/play/${route}`,
			lastModified,
			changeFrequency: "monthly",
			priority: route === "test" ? 0.7 : 0.6,
		})),
	];
}
