// Answer feedback sounds. One shared helper for every mode.
// Each sound keeps a small fixed pool of Audio elements so quick answers can
// overlap without creating unbounded objects. Callers check the
// feedbackSounds setting before calling playAnswerSound.

const FILES = { correct: "/sounds/correct.mp3", wrong: "/sounds/wrong.mp3" };
const POOL_SIZE = 3;
const pools = {};

function getPool(kind) {
	if (typeof Audio === "undefined" || !FILES[kind]) return null;
	if (!pools[kind]) {
		const items = [];
		for (let i = 0; i < POOL_SIZE; i++) {
			const a = new Audio(FILES[kind]);
			a.preload = "auto";
			a.volume = 1;
			items.push(a);
		}
		pools[kind] = { items, next: 0 };
	}
	return pools[kind];
}

export function preloadAnswerSounds() {
	try {
		getPool("correct");
		getPool("wrong");
	} catch {
		/* no audio support */
	}
}

export function playAnswerSound(kind) {
	try {
		const pool = getPool(kind);
		if (!pool) return;
		const a = pool.items[pool.next];
		pool.next = (pool.next + 1) % pool.items.length;
		a.preservesPitch = false;
		a.mozPreservesPitch = false;
		a.webkitPreservesPitch = false;
		a.playbackRate = 0.97 + Math.random() * 0.06;
		a.currentTime = 0;
		const p = a.play();
		if (p && typeof p.catch === "function") p.catch(() => {});
	} catch {
		/* autoplay blocked or unsupported */
	}
}
