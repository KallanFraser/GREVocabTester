/** @format */
"use client";

// Learn: randomized multiple choice (a crypto-shuffled deck, no repeats until
// it runs out, then a fresh shuffle). Thin wrapper over
// components/choice/ChoiceQuiz.jsx. Render it inside <Suspense> (it reads the
// URL through useSearchParams).
import ChoiceQuiz from "./choice/ChoiceQuiz";

export default function LearnMode() {
	return <ChoiceQuiz variant="learn" />;
}
