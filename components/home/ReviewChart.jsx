/** @format */
"use client";

import { useEffect, useRef } from "react";

// An illustrative forgetting curve: memory strength with Daily Review against
// reading a word once. It is a picture of the idea, not measured data (the
// card says so), but the review days are the real schedule: a newly mastered
// word is first due 1 day later, and each first-try correct answer moves it up
// one step of REVIEW_INTERVALS (passed in as a prop), so with every review
// answered right the reviews fall on the running totals of the ladder.
//
// The geometry is computed in render from the props alone, so the server and
// the client draw the same SVG, fully drawn. After mount the coral line is
// measured with getTotalLength (it needs a laid-out element) and the length is
// set as --len; the CSS then draws it in when HomeMotion reveals the card
// (data-pending removed). With reduced motion nothing moves.

const VW = 640;
const VH = 290;
const PAD = { l: 40, r: 20, t: 26, b: 40 };
const MARKERS = 5;

export default function ReviewChart({ intervals }) {
	const lineRef = useRef(null);

	useEffect(() => {
		const el = lineRef.current;
		if (!el || typeof el.getTotalLength !== "function") return undefined;
		if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
		let len = 0;
		try {
			len = el.getTotalLength();
		} catch {
			len = 0;
		}
		if (len > 0) el.style.setProperty("--len", len.toFixed(1));
		return () => el.style.removeProperty("--len");
	}, []);

	const steps = (Array.isArray(intervals) ? intervals : []).filter((n) => Number.isFinite(n) && n > 0).slice(0, MARKERS);
	if (steps.length < 2) return null;

	// Review days after mastering, with every review answered right first time.
	const reviewDays = [];
	steps.reduce((day, gap) => {
		reviewDays.push(day + gap);
		return day + gap;
	}, 0);
	const days = Math.ceil((reviewDays[reviewDays.length - 1] + 5) / 10) * 10;
	const X = (d) => PAD.l + ((VW - PAD.l - PAD.r) * d) / days;
	const Y = (r) => PAD.t + (VH - PAD.t - PAD.b) * (1 - r);

	const reviews = [0, ...reviewDays];
	const pts = [];
	let S = 0.9;
	let last = 0;
	let ri = 1;
	for (let i = 0; i <= days * 10; i++) {
		const d = i / 10;
		if (ri < reviews.length && d >= reviews[ri]) {
			pts.push([X(d), Y(0.25 + 0.75 * Math.exp(-(d - last) / S))]);
			last = reviews[ri];
			S *= 2.3;
			ri++;
			pts.push([X(d), Y(1)]);
			continue;
		}
		pts.push([X(d), Y(0.25 + 0.75 * Math.exp(-(d - last) / S))]);
	}
	const once = [];
	for (let i = 0; i <= days * 5; i++) {
		const d = i / 5;
		once.push([X(d), Y(0.12 + 0.88 * Math.exp(-d / 1.3))]);
	}
	const path = (a) => "M" + a.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" L");
	const dayWord = (n) => `${n} day${n === 1 ? "" : "s"}`;
	const label = `Illustration: memory strength stays high with Daily Review and fades after reading a word once. A newly mastered word is first reviewed after ${dayWord(steps[0])}, and each first-try correct answer moves it up one step, so the reviews fall on days ${reviewDays.join(", ")} after mastering it.`;

	return (
		<svg className="chart" viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label={label}>
			{[0, 0.25, 0.5, 0.75, 1].map((r) => (
				<line key={r} className="grid" x1={PAD.l} x2={VW - PAD.r} y1={Y(r)} y2={Y(r)} />
			))}
			<text x={PAD.l - 8} y={Y(1) + 4} textAnchor="end">
				100%
			</text>
			<text x={PAD.l - 8} y={Y(0) + 4} textAnchor="end">
				0
			</text>
			<text x={(VW + PAD.l) / 2} y={VH - 6} textAnchor="middle">
				days after mastering a word
			</text>
			<path className="once" d={path(once)} />
			<path ref={lineRef} className="draw" d={path(pts)} />
			{reviewDays.map((d, i) => (
				<g key={d} className="mk" style={{ "--i": i }}>
					<title>
						{i === 0
							? `Day ${d}: first review. A newly mastered word starts at ${dayWord(steps[0])}.`
							: `Day ${d}: answered right on the first try last time, so the gap moved up one step to ${dayWord(steps[i])}.`}
					</title>
					<circle cx={X(d)} cy={Y(1)} r="4.5" />
					<text x={X(d)} y={Y(1) - 11} textAnchor="middle">
						{steps[i]}d
					</text>
				</g>
			))}
		</svg>
	);
}
