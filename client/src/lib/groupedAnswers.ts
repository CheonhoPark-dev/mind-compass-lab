import { QUESTIONS } from "./questions";

type StoredAnswers = Readonly<Record<string, unknown>> | null | undefined;

export interface GroupedAnswer {
  questionId: number;
  questionText: string;
  score: number | null;
  status: "answered" | "missing" | "invalid";
}

export interface GroupedAnswers {
  answersByType: { type: number; label: string; answers: GroupedAnswer[] }[];
  // Keep unrecognized keys verbatim; never infer their text or type.
  unknownAnswers: { questionId: string; score: unknown }[];
}

/** Read-only projection of current canonical questions, not a scoring function. */
export function buildGroupedAnswers(answers: StoredAnswers): GroupedAnswers {
  const stored = answers ?? {};
  const questions = [...QUESTIONS].sort((a, b) => a.type - b.type || a.id - b.id);
  const canonicalIds = new Set(questions.map(question => String(question.id)));
  const answersByType: GroupedAnswers["answersByType"] = Array.from(
    { length: 9 }, (_, index) => ({ type: index + 1, label: `애니어 ${index + 1}번`, answers: [] })
  );

  for (const question of questions) {
    const value = Object.prototype.hasOwnProperty.call(stored, question.id) ? stored[question.id] : undefined;
    const isNumber = typeof value === "number" && Number.isFinite(value);
    answersByType[question.type - 1].answers.push({
      questionId: question.id,
      questionText: question.text,
      score: isNumber ? value : null,
      status: value == null ? "missing" : isNumber ? "answered" : "invalid",
    });
  }

  return {
    answersByType,
    unknownAnswers: Object.keys(stored).filter(id => !canonicalIds.has(id)).sort().map(questionId => ({
      questionId,
      score: stored[questionId] ?? null,
    })),
  };
}

/** Restricted submissions must not be enriched or downloaded, even if stale. */
export function buildSubmissionExport<T extends { answers?: StoredAnswers }>(
  submission: T,
  hasFullAccess: boolean,
): (T & GroupedAnswers) | null {
  if (!hasFullAccess) return null;
  return { ...submission, ...buildGroupedAnswers(submission.answers) };
}
