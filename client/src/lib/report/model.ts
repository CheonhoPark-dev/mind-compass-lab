import type { ResultSubmission } from "@shared/resultSubmissions";
import templates from "./typeExplanations.json";

export const MISSING = "미기록";
export const REPORT_NOTICE =
  "자기보고 응답에 따른 참고 자료입니다. 임상 진단이나 능력 평가가 아닙니다.";
export const TYPE_EXPLANATIONS = templates;

export function isType(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 9
  );
}

function name(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return MISSING;
  // One page has a finite capacity: reject oversized names, never silently cut them.
  if (Array.from(value).length > 80) {
    throw new Error(
      "이름 또는 상담사명이 너무 길어 한 페이지에 담을 수 없습니다. 80자 이내로 확인해 주세요."
    );
  }
  return value.replace(/[\s\u0000-\u001f\u007f]+/g, " ").trim();
}

function date(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value))
    return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  const calendarDate = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (
    !Number.isFinite(calendarDate.getTime()) ||
    !calendarDate.toISOString().startsWith(value.slice(0, 10))
  )
    return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);
  return ["year", "month", "day"]
    .map(key => parts.find(p => p.type === key)?.value)
    .join("-");
}

/** Strict allowlist: no answers, contact details, record IDs or stored freeform report. */
export function buildReportModel(
  submission: ResultSubmission,
  hasFullAccess: boolean
) {
  if (hasFullAccess !== true)
    throw new Error("보고서 다운로드는 전체 조회 권한이 필요합니다.");
  const result = submission.result;
  const scores = Array.from({ length: 9 }, (_, i) => {
    const value: unknown = result?.typeScores?.[i + 1];
    return {
      type: i + 1,
      score: typeof value === "number" && Number.isFinite(value) ? value : null,
    };
  });
  const recorded = scores.filter(
    (s): s is { type: number; score: number } => s.score !== null
  );
  const maximum = recorded.length
    ? Math.max(...recorded.map(s => s.score))
    : null;
  const minimum = recorded.length
    ? Math.min(...recorded.map(s => s.score))
    : null;
  const primaryType = isType(result?.primaryType) ? result.primaryType : null;
  const primaryScore =
    primaryType === null ? null : scores[primaryType - 1].score;
  const highest = recorded.filter(s => s.score === maximum).map(s => s.type);
  const lowest = recorded.filter(s => s.score === minimum).map(s => s.type);
  const wing: unknown = result?.wingCode;
  const match =
    typeof wing === "string" ? /^([1-9])w([1-9])$/.exec(wing) : null;
  const wingType = match ? Number(match[2]) : null;
  const validWing =
    primaryType !== null &&
    match !== null &&
    Number(match[1]) === primaryType &&
    (wingType === (primaryType === 1 ? 9 : primaryType - 1) ||
      wingType === (primaryType === 9 ? 1 : primaryType + 1));
  const template = primaryType === null ? null : templates[primaryType - 1];
  const primaryNote =
    primaryType === null
      ? "대표 유형 미기록 · 유형 해설 안내"
      : primaryScore === null
        ? "대표 유형 점수 미기록"
        : highest.includes(primaryType) && highest.length > 1
          ? "공동 최고점 중 대표 유형"
          : primaryScore !== maximum
            ? "저장된 대표 유형 · 최고점과 다름"
            : "";
  const submittedDate = date(submission.createdAt);
  return {
    participantName: name(submission.participant?.name),
    counselorName: name(submission.counselorName),
    submittedDate: submittedDate ?? MISSING,
    filename: `mindlab-result-${submittedDate ?? "undated"}`,
    scores,
    primaryType,
    primaryScore,
    wingCode: validWing ? (wing as string) : MISSING,
    primaryNote,
    template,
    // Ascending source order makes ties deterministic, including nine equal zeros.
    lowType: lowest[0] ?? null,
    lowScore: minimum,
    lowNote: lowest.length
      ? templates[lowest[0] - 1].lowNote
      : "저장된 점수가 없어 낮은 유형을 정하지 않았습니다. 유형별 원점수 기록을 확인해 주세요.",
    lowSelectionNote: [
      recorded.length < 9 ? "기록된 점수 기준 · 미기록 제외" : "",
      lowest.length > 1 ? "공동 최저점 중 작은 유형 번호 기준" : "",
    ]
      .filter(Boolean)
      .join(" / "),
  };
}

export type ReportModel = ReturnType<typeof buildReportModel>;

export function scoreLabel(value: number | null): string {
  return value === null ? MISSING : String(value);
}

/** A shared, dynamic display axis; never a claimed maximum or a percentage. */
export function scoreAxis(scores: ReportModel["scores"]) {
  const finite = scores.flatMap(s => (s.score === null ? [] : [s.score]));
  const min = Math.min(0, ...finite);
  const max = Math.max(0, ...finite);
  const nice = (n: number) => {
    if (n === 0) return 0;
    const step = 10 ** Math.floor(Math.log10(n));
    const rounded = Math.ceil(n / step) * step;
    return Number.isFinite(rounded) && rounded >= n ? rounded : n;
  };
  const bottom = -nice(-min);
  const top = max === 0 && min === 0 ? 1 : nice(max);
  // Divide before subtracting to keep even ±Number.MAX_VALUE arithmetic finite.
  const scale = Math.max(Math.abs(bottom), Math.abs(top));
  const position = (value: number) =>
    (value / scale - bottom / scale) / (top / scale - bottom / scale);
  return { min: bottom, max: top, position };
}
