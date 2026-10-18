// lib/storage.js — the only place that touches window.localStorage.
//
// SSR-safe: nothing here runs at import time, and every call checks for a
// browser first, so a server render (or the static export's prerender) just
// sees "nothing stored". Every access is wrapped in try/catch: private mode,
// a full quota or a blocked origin reads as empty and writes as a no-op.
//
// Values are JSON. Every key this app writes uses the gv_ prefix.

export const KEY_PREFIX = "gv_";

function store() {
	try {
		return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
	} catch {
		return null;
	}
}

export function hasStorage() {
	return store() !== null;
}

// The raw stored string, or null.
export function getRaw(key) {
	const s = store();
	if (!s) return null;
	try {
		return s.getItem(key);
	} catch {
		return null;
	}
}

// The parsed value, or `fallback` when the key is missing, unreadable or not
// JSON. A stored `null` also reads as the fallback.
export function get(key, fallback = null) {
	const raw = getRaw(key);
	if (raw == null || raw === "") return fallback;
	try {
		const v = JSON.parse(raw);
		return v == null ? fallback : v;
	} catch {
		return fallback;
	}
}

// Store `value` as JSON. Returns true when the write went through.
export function set(key, value) {
	const s = store();
	if (!s) return false;
	try {
		s.setItem(key, JSON.stringify(value));
		return true;
	} catch {
		return false;
	}
}

// Store a raw string as-is (used to restore a snapshot byte for byte).
export function setRaw(key, raw) {
	const s = store();
	if (!s) return false;
	try {
		s.setItem(key, raw);
		return true;
	} catch {
		return false;
	}
}

export function remove(key) {
	const s = store();
	if (!s) return;
	try {
		s.removeItem(key);
	} catch {
		/* ignore */
	}
}

// Every stored key starting with `prefix` ("" for all keys).
export function keys(prefix = "") {
	const s = store();
	if (!s) return [];
	const out = [];
	try {
		const n = Number(s.length);
		if (Number.isInteger(n) && typeof s.key === "function") {
			for (let i = 0; i < n; i++) {
				const k = s.key(i);
				if (typeof k === "string") out.push(k);
			}
		} else {
			out.push(...Object.keys(s));
		}
	} catch {
		return [];
	}
	return out.filter((k) => k.startsWith(prefix));
}
