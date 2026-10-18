/** @format */

import { Suspense } from "react";
import LearnMode from "../../../components/LearnMode";
import { ChoiceFallback } from "../../../components/choice/ChoiceQuiz";

// The mode reads ?pack= through useSearchParams, which a static export can only
// render on the client, below a Suspense boundary.
export default function LearnRoute() {
	return (
		<Suspense fallback={<ChoiceFallback variant="learn" />}>
			<LearnMode />
		</Suspense>
	);
}
