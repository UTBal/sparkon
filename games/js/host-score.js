/**
 * HOST-TRUSTED scoring. Host client loads /games/host/answers.host.json.
 * Not suitable for ranked play or valuable rewards. Disclose in UI.
 */
let answerKey = null;

export async function loadAnswerKey() {
  if (answerKey) return answerKey;
  const res = await fetch('/games/host/answers.host.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load host answer key');
  const data = await res.json();
  answerKey = data.answers;
  console.info('[SparkON] HOST-TRUSTED: answer key loaded in host client. Not production-secure.');
  return answerKey;
}

export function grade(roundId, conceptId, optionId) {
  const a = answerKey?.[roundId];
  if (!a) return { conceptPoints: 0, answerPoints: 0, explanation: '', correctConcept: null, correctOption: null };
  const conceptPoints = a.acceptedConceptIds.includes(conceptId) ? 1 : 0;
  const answerPoints = a.correctOptionId === optionId ? 1 : 0;
  return {
    conceptPoints,
    answerPoints,
    total: conceptPoints + answerPoints,
    explanation: a.explanation,
    correctConcept: a.acceptedConceptIds[0],
    correctOption: a.correctOptionId
  };
}

export function gradeAll(roundId, answers) {
  const results = {};
  let summary = { explanation: '', correctConcept: null, correctOption: null };
  for (const ans of answers) {
    if (ans.roundId !== roundId) continue;
    const g = grade(roundId, ans.conceptId, ans.optionId);
    results[ans.uid] = g;
    summary = g;
  }
  // still expose key even if no answers
  if (!summary.correctConcept && answerKey?.[roundId]) {
    const a = answerKey[roundId];
    summary = { explanation: a.explanation, correctConcept: a.acceptedConceptIds[0], correctOption: a.correctOptionId };
  }
  return { results, summary };
}
