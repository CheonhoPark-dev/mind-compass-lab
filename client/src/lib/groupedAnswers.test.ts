import { describe, expect, it } from "vitest";
import { QUESTIONS } from "./questions";
import { buildGroupedAnswers, buildSubmissionExport } from "./groupedAnswers";

describe("grouped answer exports (synthetic data only)", () => {
  it("maps all 81 canonical questions exactly once into nine ordered groups", () => {
    const answers = Object.fromEntries(QUESTIONS.map(q => [q.id, (q.id % 5) + 1]));
    const { answersByType, unknownAnswers } = buildGroupedAnswers(answers);
    expect(answersByType.map(g => g.type)).toEqual([1,2,3,4,5,6,7,8,9]);
    expect(answersByType.map(g => g.answers.length)).toEqual(Array(9).fill(9));
    const rows = answersByType.flatMap(g => g.answers);
    expect(rows).toHaveLength(81);
    expect(new Set(rows.map(a => a.questionId)).size).toBe(81);
    for (const group of answersByType) {
      expect(group.label).toBe(`애니어 ${group.type}번`);
      expect(group.answers.map(a => a.questionId)).toEqual(group.answers.map(a => a.questionId).sort((a,b) => a-b));
      for (const row of group.answers) {
        expect(QUESTIONS.find(q => q.id === row.questionId)).toEqual({ id: row.questionId, text: row.questionText, type: group.type });
        expect(row.score).toBe(answers[row.questionId]);
        expect(row.status).toBe("answered");
      }
    }
    expect(unknownAnswers).toEqual([]);
  });

  it("uses canonical Korean text and explicitly marks missing answers without default scores", () => {
    const rows = buildGroupedAnswers({ 3: 5 }).answersByType.flatMap(g => g.answers);
    expect(rows.find(a => a.questionId === 3)).toEqual({ questionId: 3, questionText: "나는 모든 일을 개선하기 위해 깊이 생각해서 행동한다.", score: 5, status: "answered" });
    expect(rows.filter(a => a.status === "missing")).toHaveLength(80);
    expect(rows.filter(a => a.status === "missing").every(a => a.score === null)).toBe(true);
  });

  it("handles absent, empty and invalid legacy answers without inventing scores", () => {
    for (const answers of [undefined, null, {}]) {
      expect(buildGroupedAnswers(answers).answersByType.flatMap(g => g.answers).every(a => a.status === "missing" && a.score === null)).toBe(true);
    }
    const rows = buildGroupedAnswers({ 1: 0, 2: null, 3: "5" }).answersByType.flatMap(g => g.answers);
    expect(rows.find(a => a.questionId === 1)).toMatchObject({ score: 0, status: "answered" });
    expect(rows.find(a => a.questionId === 2)).toMatchObject({ score: null, status: "missing" });
    expect(rows.find(a => a.questionId === 3)).toMatchObject({ score: null, status: "invalid" });
  });

  it("preserves unknown legacy identifiers literally and deterministically", () => {
    const answers = { "999": 4, "003": 2, "old-id": 1, "100": null };
    const result = buildGroupedAnswers(answers);
    expect(result.unknownAnswers).toEqual([
      { questionId: "003", score: 2 }, { questionId: "100", score: null },
      { questionId: "999", score: 4 }, { questionId: "old-id", score: 1 },
    ]);
    expect(result.answersByType.flatMap(g => g.answers).find(a => a.questionId === 3)?.status).toBe("missing");
  });

  it("enriches additively without mutating raw answers or scoring snapshots", () => {
    const submission = Object.freeze({ id: "SYNTHETIC-ONLY", answers: Object.freeze({ 3: 5, 999: 2 }), result: Object.freeze({ typeScores: { 1: 5 } }) });
    const before = JSON.stringify(submission);
    const exported = buildSubmissionExport(submission, true)!;
    expect(exported.answers).toBe(submission.answers);
    expect(exported.result).toBe(submission.result);
    expect(JSON.stringify(submission)).toBe(before);
    const { answersByType, unknownAnswers, ...original } = JSON.parse(JSON.stringify(exported));
    expect(original).toEqual(submission);
    expect(answersByType).toHaveLength(9);
    expect(unknownAnswers).toEqual([{ questionId: "999", score: 2 }]);
  });

  it("fails closed for restricted access even if a stale submission contains answers", () => {
    expect(buildSubmissionExport({ answers: { 3: 5 } }, false)).toBeNull();
    expect(buildSubmissionExport({ answers: {} }, false)).toBeNull();
  });
});
