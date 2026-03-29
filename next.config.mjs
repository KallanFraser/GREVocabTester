/** @format */

// /Client/next.config.mjs (ESM)
const SEC_BASE_HEADERS = [
	{ key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains; preload" },
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{ key: "X-XSS-Protection", value: "0" },
	{
		key: "Permissions-Policy",
		value: [
			"accelerometer=()",
			"camera=()",
			"geolocation=()",
			"gyroscope=()",
			"magnetometer=()",
			"microphone=()",
			"midi=()",
			"payment=()",
			"usb=()",
			"bluetooth=()",
			"xr-spatial-tracking=()",
		].join(", "),
	},
];

// prod CSP (no localhost). Dev CSP stays inside next dev server only.
const makeCSP = () =>
	[
		"default-src 'self';",
		"base-uri 'self';",
		"form-action 'self';",
		"img-src 'self' data: blob: https:;",
		"font-src 'self' data: https:;",
		"style-src 'self' 'unsafe-inline';",
		"script-src 'self' 'unsafe-inline' 'unsafe-eval';",
		"connect-src 'self';",
		"frame-ancestors 'none';",
		"object-src 'none';",
		"upgrade-insecure-requests",
	].join(" ");

const nextConfig = {
	// ⬇️ This is the key: emit a static site into /out
	output: "export",

	// If you used next/image anywhere, keep this for static export
	images: { unoptimized: true },

	reactStrictMode: true,
	poweredByHeader: false,

	// Note: headers() is ignored on static hosting (no Next server).
	// We keep it for dev, but production headers are set via /public/_headers.
	async headers() {
		if (process.env.NODE_ENV !== "production") {
			const headers = [...SEC_BASE_HEADERS, { key: "Content-Security-Policy", value: makeCSP() }];
			return [{ source: "/:path*", headers }];
		}
		return [];
	},
};

export default nextConfig;
