/** @format */

// The full answer card shown after a wrong answer (Wortschatz WordFeedback,
// adapted). The answer side is the primary line: the definition in w2d, the
// headword in d2w (Wortschatz L24). Under it the other side, then the full
// definition and the example sentence. Styles: styles/testmode.css (.fb-card).

export default function AnswerCard({ entry, direction }) {
	if (!entry) return null;
	const d2w = direction === "d2w";
	return (
		<div className="fb-card">
			<div className="hw">{d2w ? entry.word : entry.definition}</div>
			<div className="gloss">
				{d2w ? (
					<>
						{entry.definition}
						{entry.pos ? <span className="pos"> · {entry.pos}</span> : null}
					</>
				) : (
					<>
						<strong>{entry.word}</strong>
						{entry.pos ? <span className="pos"> · {entry.pos}</span> : null}
					</>
				)}
			</div>
			{entry.fullDefinition ? <p className="full">{entry.fullDefinition}</p> : null}
			{entry.example ? (
				<div className="ex">
					<span className="ex-label">Example</span>
					<p>{entry.example}</p>
				</div>
			) : null}
		</div>
	);
}
