import type { ResultSubmission } from "@shared/resultSubmissions";
import { buildSubmissionExport } from "./groupedAnswers";

// Keep user-provided labels on one line, so they cannot impersonate section headings.
function label(value: unknown): string {
  return value == null || value === "" ? "미응답" : String(value).replace(/[\r\n\u0000-\u001f\u007f]/g, " ");
}

function scoreLabel(value: unknown): string {
  return value == null ? "미응답" : typeof value === "number" && Number.isFinite(value) ? `${value}점` : "확인 필요";
}

/** Authorized submission only; same canonical projection as the JSON/viewer. */
export function buildSubmissionTxt(submission: ResultSubmission, hasFullAccess: boolean): { blob: Blob; filename: string } | null {
  if (!hasFullAccess) return null;
  const exported = buildSubmissionExport(submission, hasFullAccess);
  if (!exported) return null;
  const { participant, result } = exported;
  const lines = [
    "마음나침반연구소 검사 결과",
    "",
    "기본 정보",
    `결과 ID: ${label(exported.id)}`,
    `수신 시간: ${label(exported.createdAt)}`,
    `담당 상담사: ${label(exported.counselorName)}`,
    `설문자: ${label(participant.name)}`,
    `나이: ${participant.age == null ? "미응답" : `만 ${label(participant.age)}세`}`,
    `전화번호: ${label(exported.respondentPhone)}`,
    "",
    "검사 결과",
    `주유형: ${label(result.primaryType)}유형 ${label(result.primaryTypeName)}`,
    `날개 유형: ${label(result.wingCode)} ${label(result.wingName)}`,
    "",
    "유형별 문항 응답",
    "현재 검사 문항 기준 · 원래 문항 번호와 저장된 점수입니다.",
    "미응답은 점수를 부여하지 않습니다. 확인 필요 항목의 원본 값은 JSON 다운로드에서 확인할 수 있습니다.",
  ];
  for (const group of exported.answersByType) {
    lines.push("", group.label, "");
    for (const answer of group.answers) {
      const score = answer.status === "missing" ? "미응답" : answer.status === "invalid" ? "확인 필요" : `${answer.score}점`;
      lines.push(`${answer.questionId}. ${answer.questionText} - ${score}`, "");
    }
  }
  if (exported.unknownAnswers.length) {
    lines.push("분류되지 않은 기존 응답", "현재 문항 목록에 없는 ID입니다. 유형이나 문항 내용을 추정하지 않았습니다.", "");
    for (const answer of exported.unknownAnswers) {
      // Escape control characters only; do not normalize literal identifiers such as 003.
      const id = answer.questionId.replace(/[\u0000-\u001f\u007f]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
      lines.push(`ID ${id}. 문항 정보 없음 - ${scoreLabel(answer.score)}`, "");
    }
  }
  const date = /^\d{4}-\d{2}-\d{2}/.test(exported.createdAt) ? exported.createdAt.slice(0, 10) : "unknown-date";
  const id = exported.id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100) || "unknown-id";
  return {
    filename: `mind-compass-result-${date}-${id}.txt`,
    blob: new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/plain;charset=utf-8" }),
  };
}

export function downloadTxt(submission: ResultSubmission, hasFullAccess: boolean): void {
  if (!hasFullAccess) return;
  const exported = buildSubmissionTxt(submission, hasFullAccess);
  if (!exported) return;
  const url = URL.createObjectURL(exported.blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = exported.filename;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
