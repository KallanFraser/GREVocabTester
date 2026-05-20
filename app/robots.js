/** @format */
// Next.js file-based convention. Emits /out/robots.txt at build time
// under output: "export".

// Required under output: "export" — emit a static robots.txt at build time.
export const dynamic = "force-static";

export default function robots() {
	return {
		rules: [
			{
				userAgent: "*",
				allow: "/",
				disallow: ["/api/"],
			},
		],
		sitemap: "https://grevocabtester.com/sitemap.xml",
		host: "https://grevocabtester.com",
	};
}
