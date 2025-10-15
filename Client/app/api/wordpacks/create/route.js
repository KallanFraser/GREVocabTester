/** @format */

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const DATA_PATH = path.join(process.cwd(), "public", "data", "wordpacks.json");

// crude in-memory rate map (resets on deploy). real DB would be better.
const ipCount = new Map();

const BAD_WORDS = [
	"fuck",
	"shit",
	"bitch",
	"asshole",
	"bastard",
	"slut",
	"dick",
	"cunt",
	"whore",
	"nigger",
	"faggot",
];

function normalize(s = "") {
	return s
		.toLowerCase()
		.replace(/[@$5]/g, "s")
		.replace(/[!1|]/g, "i")
		.replace(/0/g, "o")
		.replace(/3/g, "e")
		.replace(/4/g, "a")
		.replace(/7/g, "t")
		.replace(/[^a-z\s]/g, "");
}
function hasProfanity(txt) {
	const s = normalize(txt);
	return BAD_WORDS.some((w) => s.includes(w));
}

function getClientIp(req) {
	const h = req.headers;
	const fwd = h.get("x-forwarded-for");
	if (fwd) return fwd.split(",")[0].trim();
	const real = h.get("x-real-ip");
	if (real) return real.trim();
	return "0.0.0.0";
}

function hashIp(ip) {
	const salt = process.env.IP_SALT || "dev_salt_change_me";
	return crypto
		.createHash("sha256")
		.update(ip + ":" + salt)
		.digest("hex");
}

export async function POST(req) {
	try {
		const { title, desc = "", indices } = await req.json();

		// basic validation
		if (!title || typeof title !== "string" || title.trim().length === 0 || title.length > 48) {
			return NextResponse.json({ error: "Invalid title" }, { status: 400 });
		}
		if (desc.length > 100) {
			return NextResponse.json({ error: "Description too long" }, { status: 400 });
		}
		if (!Array.isArray(indices) || indices.length < 5) {
			return NextResponse.json({ error: "Pick at least 5 words" }, { status: 400 });
		}
		// profanity
		if (hasProfanity(title) || hasProfanity(desc)) {
			return NextResponse.json({ error: "Profanity not allowed" }, { status: 400 });
		}

		// sanitize indices: unique, ints, within range (we don't know max here → allow 0..10000)
		const cleaned = Array.from(
			new Set(indices.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0 && n < 10000))
		);
		if (cleaned.length < 5) {
			return NextResponse.json({ error: "Invalid indices" }, { status: 400 });
		}

		// IP limit
		const ip = getClientIp(req);
		const count = ipCount.get(ip) || 0;
		if (count >= 5) {
			return NextResponse.json({ error: "Limit reached: 5 packs per IP" }, { status: 429 });
		}

		// read existing
		let data = [];
		try {
			const raw = await fs.readFile(DATA_PATH, "utf8");
			data = JSON.parse(raw);
			if (!Array.isArray(data)) data = [];
		} catch {
			data = [];
		}

		// also enforce per-IP max against existing (using hashed IP)
		const ipHash = hashIp(ip);
		const existingFromIp = data.filter((p) => p.authorIpHash === ipHash).length;
		if (existingFromIp >= 5) {
			return NextResponse.json({ error: "Limit reached: 5 packs per IP" }, { status: 429 });
		}

		// create id slug
		const base = title
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");
		let id = base || "pack";
		let suffix = 1;
		const idSet = new Set(data.map((p) => p.id));
		while (idSet.has(id)) id = `${base}-${suffix++}`;

		const now = new Date().toISOString();

		const newPack = {
			id,
			title: title.trim(),
			desc: desc.trim(),
			indices: cleaned,
			likes: 0,
			createdAt: now,
			authorIpHash: ipHash, // stored hashed (privacy)
		};

		const updated = [newPack, ...data]; // prepend so it surfaces
		await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
		await fs.writeFile(DATA_PATH, JSON.stringify(updated, null, 2), "utf8");

		ipCount.set(ip, count + 1);

		return NextResponse.json({ ok: true, id });
	} catch (e) {
		console.error("create wordpack error", e);
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}
