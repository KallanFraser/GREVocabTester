// Unit tests for lib/packs.js. Run with `node --test tests/`.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

class MemoryStorage {
	constructor() {
		this.map = new Map();
	}
	get length() {
		return this.map.size;
	}
	key(i) {
		return [...this.map.keys()][i] ?? null;
	}
	getItem(k) {
		return this.map.has(k) ? this.map.get(k) : null;
	}
	setItem(k, v) {
		this.map.set(k, String(v));
	}
	removeItem(k) {
		this.map.delete(k);
	}
	clear() {
		this.map.clear();
	}
}

const storage = new MemoryStorage();
const K = await import("../lib/packs.js");

const PACKS_JSON = [
	{
		id: "argument-verbs",
		title: "Argument & Rhetoric Verbs",
		desc: "Verbs that appear in arguments.",
		category: "theme",
		order: 2,
		indices: [21, 90],
		likes: 108,
		words: ["Advocate", "Bolster", "Coalesce", "Condone", "Confound", " Bolster "],
	},
	{ id: "path-1", title: "Path 1", category: "path", tier: 1, order: "1", words: ["Abate", "Cajole", "Deride", "Enervate", "Fervid"] },
	{ id: "old", title: "Old pack", words: ["Guy", "Stand", "Brook", "Novel", "Thrift"] },
	{ id: "argument-verbs", title: "Duplicate id", words: ["X"] },
	{ id: "", title: "No id", words: ["X"] },
	{ id: "empty", title: "No words", words: [] },
	"junk",
];

let fetchCalls = 0;
function fakeFetch(body, ok = true) {
	return async (url) => {
		fetchCalls += 1;
		assert.equal(url, "/data/wordpacks.json");
		return { ok, json: async () => body };
	};
}

// The frozen pre-overhaul key order would come from lib/words.js; this stub
// maps indices onto a tiny fixed list.
const LEGACY_ORDER = ["Abate", "Bolster", "Cajole", "Deride", "Enervate", "Fervid", "Guy"];
const resolveLegacyIndices = (indices) => indices.map((i) => LEGACY_ORDER[i]).filter(Boolean);
const opts = { fetch: fakeFetch(PACKS_JSON), resolveLegacyIndices };

beforeEach(() => {
	globalThis.window = { localStorage: storage };
	storage.clear();
	K.resetPacksCache();
	fetchCalls = 0;
});

// ---------------------------------------------------------------------------
// Built-in packs
// ---------------------------------------------------------------------------

test("loadPacks fetches once, caches, and normalizes", async () => {
	const a = await K.loadPacks(opts);
	const b = await K.loadPacks(opts);
	assert.equal(a, b);
	assert.equal(fetchCalls, 1);
	assert.deepEqual(
		a.map((p) => p.id),
		["argument-verbs", "path-1", "old"],
	);
	assert.deepEqual(a[0], {
		id: "argument-verbs",
		title: "Argument & Rhetoric Verbs",
		desc: "Verbs that appear in arguments.",
		category: "theme",
		order: 2,
		words: ["Advocate", "Bolster", "Coalesce", "Condone", "Confound"],
	});
	assert.equal(a[1].tier, 1);
	assert.equal(a[1].order, 1);
	assert.equal(a[2].category, "classic", "missing category defaults to classic");
	assert.equal("tier" in a[2], false);
	assert.equal("indices" in a[0], false, "positions are never carried");
});

test("a failed fetch is not cached", async () => {
	assert.deepEqual(await K.loadPacks({ fetch: fakeFetch(null, false) }), []);
	assert.equal((await K.loadPacks(opts)).length, 3);
	K.resetPacksCache();
	assert.deepEqual(
		await K.loadPacks({
			fetch: async () => {
				throw new Error("offline");
			},
		}),
		[],
	);
	K.resetPacksCache();
	assert.deepEqual(await K.loadPacks({ fetch: fakeFetch({ not: "a list" }) }), []);
});

test("normalizePack rejects packs with no id or words and coerces category", () => {
	assert.equal(K.normalizePack(null), null);
	assert.equal(K.normalizePack({ id: "x", words: [] }), null);
	assert.equal(K.normalizePack({ id: "x", words: ["A"], category: "weird" }).category, "classic");
	assert.equal(K.normalizePack({ id: "x", words: ["A"] }).title, "x");
	assert.equal(K.normalizePack({ id: "x", words: ["A"], tier: "high" }).tier, undefined);
});

// ---------------------------------------------------------------------------
// Custom packs
// ---------------------------------------------------------------------------

const FIVE = ["Abate", "Bolster", "Cajole", "Deride", "Enervate"];

test("custom packs: create, update, delete", () => {
	const p = K.createCustomPack({ title: "  My   pack ", desc: "Mine", words: [...FIVE, "Abate"] });
	assert.ok(p.id.startsWith("custom-"));
	assert.equal(p.title, "My pack");
	assert.deepEqual(p.words, FIVE);
	assert.ok(K.isCustomPackId(p.id));
	assert.deepEqual(K.loadCustomPacks(), [p]);
	assert.deepEqual(K.getCustomPack(p.id), p);

	const q = K.createCustomPack({ title: "Second", words: FIVE });
	assert.notEqual(q.id, p.id);

	const u = K.updateCustomPack(p.id, { title: "Renamed", words: [...FIVE, "Fervid"] });
	assert.equal(u.title, "Renamed");
	assert.equal(u.desc, "Mine", "untouched fields stay");
	assert.equal(u.words.length, 6);
	assert.equal(K.getCustomPack(p.id).title, "Renamed");
	assert.equal(K.updateCustomPack("custom-missing", { title: "x" }), null);

	assert.equal(K.deleteCustomPack(p.id), true);
	assert.equal(K.deleteCustomPack(p.id), false);
	assert.deepEqual(
		K.loadCustomPacks().map((x) => x.id),
		[q.id],
	);
	assert.ok(storage.getItem("gv_custom_packs"));
});

test("custom packs: validation", () => {
	assert.throws(() => K.createCustomPack({ title: "", words: FIVE }), /title/);
	assert.throws(() => K.createCustomPack({ title: "Short", words: FIVE.slice(0, 4) }), /at least 5/);
	const p = K.createCustomPack({ title: "x".repeat(80), desc: "d".repeat(200), words: FIVE });
	assert.equal(p.title.length, K.MAX_TITLE_LENGTH);
	assert.equal(p.desc.length, K.MAX_DESC_LENGTH);
	assert.throws(() => K.updateCustomPack(p.id, { words: ["Abate"] }), /at least 5/);
	assert.equal(K.getCustomPack(p.id).words.length, 5, "a rejected update changes nothing");
});

test("custom packs: corrupt storage is repaired on read", () => {
	storage.setItem(
		"gv_custom_packs",
		JSON.stringify([{ id: "custom-a", words: ["A"] }, { id: "not-custom", words: ["A"] }, { id: "custom-a", words: ["B"] }, 5, { id: "custom-b" }]),
	);
	const list = K.loadCustomPacks();
	assert.deepEqual(
		list.map((p) => [p.id, p.words]),
		[["custom-a", ["A"]]],
	);
	storage.setItem("gv_custom_packs", "{oops");
	assert.deepEqual(K.loadCustomPacks(), []);
});

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

test("favorites: one-time migration from the like ledger and legacy wp_likes keys", () => {
	storage.setItem("wp_upvote_ledger_v2", JSON.stringify({ "gre-elite-30": true, "power-S": false, "argument-verbs": true }));
	storage.setItem("wp_likes:emotion-spectrum", "3");
	storage.setItem("wp_likes:argument-verbs", "1");
	storage.setItem("wp_likes:power-G", "0");
	storage.setItem("wp_likes:junk", "abc");
	const ids = K.loadFavorites();
	assert.deepEqual([...ids].sort(), ["argument-verbs", "emotion-spectrum", "gre-elite-30"]);
	assert.deepEqual(JSON.parse(storage.getItem("gv_favorites")).ids.sort(), [...ids].sort());
	assert.ok(storage.getItem("wp_upvote_ledger_v2"), "legacy keys are copied, not moved");

	// Runs once: a later ledger change is not re-imported.
	storage.setItem("wp_upvote_ledger_v2", JSON.stringify({ "power-P": true }));
	assert.equal(K.isFavorite("power-P"), false);
});

test("favorites: set, toggle, no legacy data", () => {
	assert.deepEqual(K.loadFavorites(), []);
	assert.deepEqual(K.setFavorite("a", true), ["a"]);
	assert.deepEqual(K.setFavorite("b", true), ["a", "b"]);
	assert.deepEqual(K.setFavorite("a", true), ["b", "a"]);
	assert.deepEqual(K.toggleFavorite("b"), ["a"]);
	assert.equal(K.isFavorite("a"), true);
	assert.deepEqual(K.toggleFavorite("a"), []);
	assert.deepEqual(K.setFavorite("", true), []);
});

// ---------------------------------------------------------------------------
// resolvePackContext
// ---------------------------------------------------------------------------

test("?pack=<id> resolves a built-in pack", async () => {
	const ctx = await K.resolvePackContext("?pack=argument-verbs", opts);
	assert.deepEqual(ctx, {
		id: "argument-verbs",
		title: "Argument & Rhetoric Verbs",
		words: ["Advocate", "Bolster", "Coalesce", "Condone", "Confound"],
		source: "pack",
	});
});

test("?pack=<id> resolves a custom pack without fetching", async () => {
	const p = K.createCustomPack({ title: "Mine", words: FIVE });
	const ctx = await K.resolvePackContext(new URLSearchParams({ pack: p.id }), opts);
	assert.deepEqual(ctx, { id: p.id, title: "Mine", words: FIVE, source: "custom" });
	assert.equal(fetchCalls, 0);
});

test("unknown or deleted pack ids resolve to { missingId }", async () => {
	assert.deepEqual(await K.resolvePackContext("?pack=nope", opts), { missingId: "nope" });
	assert.deepEqual(await K.resolvePackContext("?pack=custom-nope", opts), { missingId: "custom-nope" });
	assert.deepEqual(await K.resolvePackContext("?id=gone", opts), { missingId: "gone" });
	assert.equal(K.isMissingPack({ missingId: "nope" }), true);
	assert.equal(K.isMissingPack(null), false);
	assert.equal(K.isMissingPack({ id: "a", words: ["Abate"] }), false);
	assert.match(K.MISSING_PACK_NOTICE, /no longer exists, showing all words/);
	// Another valid source in the URL still wins.
	assert.deepEqual((await K.resolvePackContext("?pack=nope&words=Abate,Guy", opts)).words, ["Abate", "Guy"]);
	// No pack named: the full list.
	assert.equal(await K.resolvePackContext("", opts), null);
	assert.equal(await K.resolvePackContext(null, opts), null);
});

test("a deleted custom pack resolves to { missingId }", async () => {
	const p = K.createCustomPack({ title: "Mine", words: ["Abate", "Bolster", "Cajole", "Deride", "Enervate"] });
	assert.equal((await K.resolvePackContext(`?pack=${p.id}`, opts)).id, p.id);
	K.deleteCustomPack(p.id);
	assert.deepEqual(await K.resolvePackContext(`?pack=${p.id}`, opts), { missingId: p.id });
});

test("a failed pack list load is not reported as a missing pack", async () => {
	const down = { ...opts, fetch: fakeFetch(null, false) };
	assert.equal(await K.resolvePackContext("?pack=argument-verbs", down), null);
});

test("?words=a,b,c is the share-link format", async () => {
	const ctx = await K.resolvePackContext("?words=Abate,%20Bolster,,Abate,Cajole", opts);
	assert.deepEqual(ctx, { id: null, title: "Shared selection", words: ["Abate", "Bolster", "Cajole"], source: "words" });
	// Next's searchParams object shape works too.
	assert.deepEqual((await K.resolvePackContext({ words: ["Guy,Stand"] }, opts)).words, ["Guy", "Stand"]);
});

test("legacy ?pack=12,45 (digits only) goes through resolveLegacyIndices", async () => {
	let seen = null;
	const ctx = await K.resolvePackContext("?pack=0, 2,6,", {
		...opts,
		resolveLegacyIndices: (indices) => {
			seen = indices;
			return resolveLegacyIndices(indices);
		},
	});
	assert.deepEqual(seen, [0, 2, 6]);
	assert.deepEqual(ctx, { id: null, title: "Shared selection", words: ["Abate", "Cajole", "Guy"], source: "legacy" });
	assert.equal(await K.resolvePackContext("?pack=999", opts), null, "out-of-range indices resolve to nothing");
	// A failing resolver never throws out of resolvePackContext.
	const failing = {
		...opts,
		resolveLegacyIndices: () => {
			throw new Error("boom");
		},
	};
	assert.equal(await K.resolvePackContext("?pack=1,2", failing), null);
});

test("legacy ?id=<packId> still opens the pack", async () => {
	const ctx = await K.resolvePackContext("?id=path-1", opts);
	assert.equal(ctx.id, "path-1");
	assert.equal(ctx.source, "pack");
});

test("the marketplaceWordpack handoff is read once and deleted", async () => {
	storage.setItem("marketplaceWordpack", JSON.stringify([1, 3, -2, "x", 5]));
	const ctx = await K.resolvePackContext("", opts);
	assert.deepEqual(ctx, { id: null, title: "Selected pack", words: ["Bolster", "Deride", "Fervid"], source: "handoff" });
	assert.equal(storage.getItem("marketplaceWordpack"), null);
	// Once the page has used it, the cached copy is cleared: a play page opened
	// later in the same page load (client navigation) finds nothing.
	await new Promise((r) => setTimeout(r, 5));
	assert.equal(await K.resolvePackContext("", opts), null);
	// A new page load (cache reset) finds nothing either.
	K.resetPacksCache();
	assert.equal(await K.resolvePackContext("", opts), null);
});

test("StrictMode's double mount (same tick) sees the same handoff", async () => {
	storage.setItem("marketplaceWordpack", JSON.stringify([0, 2]));
	const [a, b] = await Promise.all([K.resolvePackContext("", opts), K.resolvePackContext("", opts)]);
	assert.deepEqual(a.words, ["Abate", "Cajole"]);
	assert.deepEqual(b.words, ["Abate", "Cajole"]);
	await new Promise((r) => setTimeout(r, 5));
	assert.equal(await K.resolvePackContext("", opts), null);
});

test("malformed gv_custom_packs and gv_favorites read as empty", () => {
	for (const raw of ['{"a":1}', "42", '"text"', "true", "{bad"]) {
		storage.setItem("gv_custom_packs", raw);
		assert.deepEqual(K.loadCustomPacks(), [], raw);
		assert.equal(K.getCustomPack("custom-x"), null);
		storage.setItem("gv_favorites", raw);
		assert.deepEqual(K.loadFavorites(), [], raw);
	}
	// Bad entries in an array are dropped, good ones kept and repaired.
	storage.setItem(
		"gv_custom_packs",
		JSON.stringify([null, 7, { id: "custom-a", title: "  A  ", words: ["Abate", 3, "Abate", "Guy"] }, { id: "nope", words: ["X"] }]),
	);
	const list = K.loadCustomPacks();
	assert.equal(list.length, 1);
	assert.deepEqual(list[0].words, ["Abate", "Guy"]);
	assert.equal(list[0].title, "A");
	assert.deepEqual(K.normalizeFavoritesValue({ ids: ["a", 1, "a", "b"] }), { version: 1, ids: ["a", "b"] });
});

test("deleting a custom pack removes its progress, Harder runs and practice position", () => {
	const p = K.createCustomPack({ title: "Mine", words: ["Abate", "Bolster", "Cajole", "Deride", "Enervate"] });
	const scopes = (extra) => ({ scopes: { [p.id]: { mastered: ["Abate"], streaks: {} }, other: { mastered: [], streaks: {} }, ...extra } });
	storage.setItem("gv_progress_w2d", JSON.stringify(scopes()));
	storage.setItem("gv_progress_d2w", JSON.stringify(scopes()));
	storage.setItem("gv_hard_w2d", JSON.stringify(scopes({ [`${p.id}#subset`]: { run: null, count: 1, runs: [] } })));
	storage.setItem("gv_practice_pos", JSON.stringify({ [p.id]: 3, all: 2 }));
	storage.setItem("gv_last_pack", JSON.stringify({ id: p.id, title: "Mine", words: ["Abate"] }));
	assert.equal(K.deleteCustomPack(p.id), true);
	for (const key of ["gv_progress_w2d", "gv_progress_d2w", "gv_hard_w2d"]) {
		assert.deepEqual(Object.keys(JSON.parse(storage.getItem(key)).scopes), ["other"], key);
	}
	assert.deepEqual(JSON.parse(storage.getItem("gv_practice_pos")), { all: 2 });
	assert.equal(storage.getItem("gv_last_pack"), null);
});

test("deleting a custom pack removes it from favorites and keeps the others", () => {
	const p = K.createCustomPack({ title: "Mine", words: ["Abate", "Bolster", "Cajole", "Deride", "Enervate"] });
	K.setFavorite("argument-verbs", true);
	K.setFavorite(p.id, true);
	assert.deepEqual(K.loadFavorites(), ["argument-verbs", p.id]);
	assert.equal(K.deleteCustomPack(p.id), true);
	assert.deepEqual(K.loadFavorites(), ["argument-verbs"]);
	assert.equal(K.isFavorite(p.id), false);
	// No gv_favorites yet: deleting leaves it unwritten, so the legacy likes
	// still migrate on the first read.
	const q = K.createCustomPack({ title: "Other", words: ["Abate", "Bolster", "Cajole", "Deride", "Enervate"] });
	storage.removeItem("gv_favorites");
	storage.setItem("wp_upvote_ledger_v2", JSON.stringify({ "argument-verbs": true }));
	assert.equal(K.deleteCustomPack(q.id), true);
	assert.equal(storage.getItem("gv_favorites"), null);
	assert.deepEqual(K.loadFavorites(), ["argument-verbs"]);
});

test("the URL wins over the handoff, and the handoff is deleted anyway", async () => {
	// The pre-overhaul /wordpacks page set both the key and ?id=.
	storage.setItem("marketplaceWordpack", JSON.stringify([0, 1]));
	const ctx = await K.resolvePackContext("?id=argument-verbs", opts);
	assert.equal(ctx.id, "argument-verbs");
	assert.equal(storage.getItem("marketplaceWordpack"), null);
});

test("bad handoff JSON is deleted and ignored", async () => {
	storage.setItem("marketplaceWordpack", "{bad");
	assert.equal(await K.resolvePackContext("", opts), null);
	assert.equal(storage.getItem("marketplaceWordpack"), null);
});

test("default legacy resolver: lib/words.js maps old ?pack= indices to each pack's words", async () => {
	const { registerHooks } = await import("node:module");
	const { readFileSync } = await import("node:fs");
	// lib/words.js imports JSON without import attributes (Next style).
	registerHooks({
		load(url, context, nextLoad) {
			if (!url.endsWith(".json")) return nextLoad(url, context);
			return nextLoad(url, { ...context, importAttributes: { ...context.importAttributes, type: "json" } });
		},
	});
	const real = JSON.parse(readFileSync(new URL("../public/data/wordpacks.json", import.meta.url), "utf8"));
	const withIndices = real.filter((p) => Array.isArray(p.indices) && p.indices.length);
	for (const p of withIndices) {
		const ctx = await K.resolvePackContext(`?pack=${p.indices.join(",")}`, { fetch: fakeFetch([]) });
		assert.deepEqual(ctx && ctx.words, [...new Set(p.words)], p.id);
	}
});

test("resolvePackContext is SSR-safe", async () => {
	delete globalThis.window;
	assert.equal(await K.resolvePackContext("", opts), null);
	assert.equal((await K.resolvePackContext("?pack=old", opts)).id, "old");
});
