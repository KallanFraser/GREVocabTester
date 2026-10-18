/** @format */

// Static export: `next build` emits the whole site into /out. There is no Next
// server in production, so headers(), rewrites() and API routes would never
// run; security headers live in public/_headers instead.
const nextConfig = {
	output: "export",

	// No image optimizer exists in a static export.
	images: { unoptimized: true },

	reactStrictMode: true,
	poweredByHeader: false,
};

export default nextConfig;
