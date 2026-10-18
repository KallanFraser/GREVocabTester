/** @format */

import { Suspense } from "react";
import PracticeMode from "../../../components/PracticeMode";
import { ChoiceFallback } from "../../../components/choice/ChoiceQuiz";

// The mode reads ?pack= through useSearchParams, which a static export can only
// render on the client, below a Suspense boundary.
export default function PracticeRoute() {
	return (
		<Suspense fallback={<ChoiceFallback variant="practice" />}>
			<PracticeMode />
		</Suspense>
	);
}
