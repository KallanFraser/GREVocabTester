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

const makeCSP = ({ dev } = { dev: false }) =>
	[
		"default-src 'self';",
		"base-uri 'self';",
		"form-action 'self';",
		"img-src 'self' data: blob: https:;",
		"font-src 'self' data: https:;",
		`style-src 'self' 'unsafe-inline'${dev ? " http://localhost:*" : ""};`,
		`script-src 'self'${dev ? " 'unsafe-inline' 'unsafe-eval' http://localhost:*" : " 'unsafe-inline'"};`,
		`connect-src 'self'${dev ? " ws://localhost:* http://localhost:*" : ""};`,
		"frame-ancestors 'none';",
		"object-src 'none';",
		...(dev ? [] : ["upgrade-insecure-requests"]),
	].join(" ");

const nextConfig = {
	reactStrictMode: true,
	poweredByHeader: false,
	async headers() {
		const dev = process.env.NODE_ENV !== "production";
		const headers = [...SEC_BASE_HEADERS, { key: "Content-Security-Policy", value: makeCSP({ dev }) }];
		return [{ source: "/:path*", headers }];
	},
};

export default nextConfig;
