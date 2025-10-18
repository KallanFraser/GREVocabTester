/** @format */

// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** ===== Config ===== */
const WINDOW_MS = 60_000; // 1 minute window
const LIMIT_DEFAULT = 60; // all routes
const LIMIT_API = 10; // /api/* routes

/** ===== Simple in-memory buckets (dev/small apps).
 * For production across regions/instances, switch to Redis (Upstash).
 */
const buckets = new Map<string, { tokens: number; reset: number }>();

/** Get client IP from proxy/CDN headers (works on Vercel/Cloudflare/Render) */
function getClientIP(req: NextRequest): string {
	const cf = req.headers.get("cf-connecting-ip");
	const real = req.headers.get("x-real-ip");
	const xff = req.headers.get("x-forwarded-for");
	const firstForwarded = xff?.split(",")[0]?.trim();
	return cf || real || firstForwarded || "0.0.0.0";
}

/** Skip static assets, Next internals, and preflight */
function shouldBypass(req: NextRequest): boolean {
	const p = req.nextUrl.pathname;
	if (req.method === "OPTIONS") return true;
	if (
		p.startsWith("/_next") ||
		p.startsWith("/favicon") ||
		p.startsWith("/static") ||
		p.startsWith("/assets")
	) {
		return true;
	}
	if (/\.(png|jpe?g|gif|webp|svg|ico|css|js|map|txt|xml|woff2?|ttf|otf)$/i.test(p)) return true;
	return false;
}

/** Token bucket */
function take(key: string, limit: number) {
	const now = Date.now();
	const b = buckets.get(key) ?? { tokens: limit, reset: now + WINDOW_MS };
	if (now > b.reset) {
		b.tokens = limit;
		b.reset = now + WINDOW_MS;
	}
	if (b.tokens <= 0) {
		return { ok: false as const, reset: b.reset, remaining: 0, limit };
	}
	b.tokens -= 1;
	buckets.set(key, b);
	return { ok: true as const, reset: b.reset, remaining: b.tokens, limit };
}

export function middleware(req: NextRequest) {
	if (shouldBypass(req)) return NextResponse.next();

	const ip = getClientIP(req);
	const path = req.nextUrl.pathname;
	const isAPI = path.startsWith("/api");
	const limit = isAPI ? LIMIT_API : LIMIT_DEFAULT;
	const bucketKey = `${ip}:${isAPI ? "api" : "web"}`;

	const result = take(bucketKey, limit);

	if (!result.ok) {
		const retry = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
		const res = NextResponse.json({ message: "Too many requests" }, { status: 429 });
		res.headers.set("Retry-After", String(retry));
		res.headers.set("X-RateLimit-Limit", String(result.limit));
		res.headers.set("X-RateLimit-Remaining", "0");
		res.headers.set("X-RateLimit-Reset", String(Math.floor(result.reset / 1000)));
		return res;
	}

	const res = NextResponse.next();
	res.headers.set("X-RateLimit-Limit", String(result.limit));
	res.headers.set("X-RateLimit-Remaining", String(result.remaining));
	res.headers.set("X-RateLimit-Reset", String(Math.floor(result.reset / 1000)));
	return res;
}

/** Run on everything; we bypass assets inside the handler */
export const config = { matcher: ["/:path*"] };
