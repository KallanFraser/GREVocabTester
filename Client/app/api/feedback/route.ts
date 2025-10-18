/** @format */

// app/api/feedback/route.ts
import { z } from "zod";
// Optional: if you set up cors helper earlier
// import { cors } from "../../../lib/cors";

const Feedback = z.object({
	message: z.string().min(1, "Message is required").max(2000, "Message too long (max 2000)"),
	email: z.string().email("Invalid email").optional(),
});

const MAX_BYTES = 20 * 1024; // 20KB cap for this endpoint; adjust as needed

function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json",
			// ...cors(req.headers.get("origin")), // uncomment if using CORS helper
			...extraHeaders,
		},
	});
}

export async function POST(req: Request) {
	// 1) Content-Type check
	const ct = req.headers.get("content-type") || "";
	if (!ct.toLowerCase().includes("application/json")) {
		return jsonResponse({ error: "Content-Type must be application/json" }, 415);
	}

	// 2) Size guard (cheap)
	const len = Number(req.headers.get("content-length") || "0");
	if (len > MAX_BYTES) {
		return jsonResponse({ error: `Payload too large (>${MAX_BYTES} bytes)` }, 413);
	}

	// 3) Parse JSON safely
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return jsonResponse({ error: "Invalid JSON" }, 400);
	}

	// 4) Validate with Zod
	const parsed = Feedback.safeParse(body);
	if (!parsed.success) {
		const errors = parsed.error.flatten();
		return jsonResponse(
			{
				error: "Bad Request",
				fieldErrors: errors.fieldErrors, // { message?: ["..."], email?: ["..."] }
				formErrors: errors.formErrors,
			},
			400
		);
	}

	const data = parsed.data; // { message: string, email?: string }

	// 5) TODO: do something useful (store, email, queue, etc.)
	// Example: console.log (replace with your persistence)
	console.log("[feedback] received", {
		len: data.message.length,
		hasEmail: Boolean(data.email),
	});

	return jsonResponse({ ok: true }, 201);
}

// CORS preflight (only if you call this cross-origin)
export async function OPTIONS(req: Request) {
	// return new Response(null, { status: 204, headers: cors(req.headers.get("origin")) });
	return new Response(null, { status: 204 });
}
