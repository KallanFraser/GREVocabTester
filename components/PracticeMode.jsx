/** @format */
"use client";

// Practice: sequential multiple choice, resuming where the learner left off in
// each scope. Thin wrapper over components/choice/ChoiceQuiz.jsx. Render it
// inside <Suspense> (it reads the URL through useSearchParams).
import ChoiceQuiz from "./choice/ChoiceQuiz";

export default function PracticeMode() {
	return <ChoiceQuiz variant="practice" />;
}
