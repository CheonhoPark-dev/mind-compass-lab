import { useCallback, useEffect, useMemo, useState } from "react";
import "./results-dashboard.css";
import { ReportDownloadButtons } from "@/components/ReportDownloadButtons";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { buildSubmissionExport } from "@/lib/groupedAnswers";
import { downloadTxt } from "@/lib/submissionTxt";
import type {
  ResultSubmission,
  ResultSubmissionListResponse,
} from "@shared/resultSubmissions";
import {
  Compass,
  Download,
  Eye,
  KeyRound,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

const ACCESS_KEY_STORAGE_KEY = "mindCompassResultAccessKey";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function downloadJson(
  submission: ResultSubmission,
  hasFullAccess: boolean
) {
  const exported = buildSubmissionExport(submission, hasFullAccess);
  if (!exported) return;
  const blob = new Blob([JSON.stringify(exported, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `mind-compass-result-${submission.createdAt.slice(0, 10)}-${submission.id}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function TxtDownloadButton({
  submission,
  hasFullAccess,
}: {
  submission: ResultSubmission;
  hasFullAccess: boolean;
}) {
  return (
    <Button
      type="button"
      variant="default"
      onClick={() => {
        if (hasFullAccess) downloadTxt(submission, hasFullAccess);
      }}
      disabled={!hasFullAccess}
      className="rd-txt h-11 gap-2 font-bold"
    >
      <Download className="w-4 h-4" aria-hidden="true" />
      TXT 다운로드
    </Button>
  );
}

export function GroupedAnswerDetails({
  answers,
  hasFullAccess,
}: {
  answers: ResultSubmission["answers"];
  hasFullAccess: boolean;
}) {
  const grouped = useMemo(
    () => buildSubmissionExport({ answers }, hasFullAccess),
    [answers, hasFullAccess]
  );
  if (!grouped) {
    return (
      <p className="mt-4 text-xs text-muted-foreground">
        문항별 응답은 전체 조회 권한이 필요합니다.
      </p>
    );
  }

  return (
    <details className="mt-4 rounded-2xl border border-border bg-background p-4">
      <summary className="cursor-pointer text-sm font-bold">
        유형별 문항 응답 보기
      </summary>
      <p className="mt-3 text-xs text-muted-foreground">
        현재 검사 문항 기준 · 원래 문항 번호와 저장된 점수입니다. 미응답은
        점수를 부여하지 않습니다.
      </p>
      <div className="mt-4 space-y-3">
        {grouped.answersByType.map(group => (
          <details
            key={group.type}
            className="rounded-xl border border-border p-3"
          >
            <summary className="cursor-pointer text-sm font-bold text-primary">
              {group.label}
            </summary>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed">
              {group.answers.map(answer => (
                <li key={answer.questionId}>
                  {`${answer.questionId}. ${answer.questionText} - ${answer.status === "answered" ? `${answer.score}점` : answer.status === "missing" ? "미응답" : "점수 형식 확인 필요 (원본 JSON 참조)"}`}
                </li>
              ))}
            </ul>
          </details>
        ))}
        {grouped.unknownAnswers.length > 0 && (
          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer text-sm font-bold">
              분류되지 않은 기존 응답
            </summary>
            <p className="mt-2 text-xs text-muted-foreground">
              현재 문항 목록에 없는 ID입니다. 유형이나 문항 내용을 추정하지
              않았습니다.
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed">
              {grouped.unknownAnswers.map(answer => (
                <li key={answer.questionId}>
                  {`${answer.questionId}. 문항 정보 없음 - ${typeof answer.score === "number" && Number.isFinite(answer.score) ? `${answer.score}점` : answer.score == null ? "미응답" : "점수 형식 확인 필요 (원본 JSON 참조)"}`}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </details>
  );
}

export default function ResultsDashboard() {
  const [submissions, setSubmissions] = useState<ResultSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [accessKey, setAccessKey] = useState(
    () => sessionStorage.getItem(ACCESS_KEY_STORAGE_KEY) ?? ""
  );
  const [pendingAccessKey, setPendingAccessKey] = useState(accessKey);
  const [requiresAccessKey, setRequiresAccessKey] = useState(false);
  const [hasFullAccess, setHasFullAccess] = useState(false);
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSubmissions = useCallback(
    async (key = accessKey) => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch("/api/result-submissions?limit=300", {
          headers: key ? { Authorization: `Bearer ${key}` } : undefined,
        });
        const data = await response.json().catch(() => null);

        if (response.status === 401) {
          setRequiresAccessKey(true);
          setHasFullAccess(false);
          setSubmissions([]);
          return;
        }

        if (!response.ok || !data) {
          throw new Error(data?.error ?? "결과 목록을 불러오지 못했습니다.");
        }

        const result = data as ResultSubmissionListResponse;
        setSubmissions(result.submissions);
        setTotal(result.total);
        setRequiresAccessKey(false);
        setHasFullAccess(result.hasFullAccess);

        if (key) {
          sessionStorage.setItem(ACCESS_KEY_STORAGE_KEY, key);
        }
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "결과 목록을 불러오지 못했습니다."
        );
        toast.error(
          error instanceof Error
            ? error.message
            : "결과 목록을 불러오지 못했습니다."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [accessKey]
  );

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const filteredSubmissions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return submissions;

    return submissions.filter(submission => {
      const haystack = [
        submission.counselorName,
        submission.respondentPhone,
        submission.participant.name,
        submission.result.wingCode,
        submission.result.wingName,
        submission.result.primaryTypeName,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [query, submissions]);

  const latestSubmission = submissions[0];

  const handleAccessKeySubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const key = pendingAccessKey.trim();

    setAccessKey(key);
    loadSubmissions(key);
  };

  return (
    <div className="rd-dashboard">
      <a href="#results-main" className="rd-skip">
        본문으로 바로가기
      </a>
      <header className="rd-header">
        <div className="rd-shell rd-header-inner">
          <a href="/" className="rd-brand" aria-label="마음나침반연구소 홈">
            <Compass size={32} strokeWidth={1.3} aria-hidden="true" />
            <span>
              <strong>마음나침반연구소</strong>
              <small>Mind Compass Lab</small>
            </span>
          </a>
          <span className="rd-workspace">상담사 전용 · 결과 관리</span>
          <Button
            variant="outline"
            onClick={() => loadSubmissions()}
            disabled={isLoading || requiresAccessKey}
            className="rd-refresh"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCcw size={16} aria-hidden="true" />
            )}{" "}
            새로고침
          </Button>
        </div>
      </header>
      <main id="results-main" className="rd-shell rd-main">
        <div className="rd-heading">
          <p className="rd-eyebrow">상담 기록 / 검사 결과</p>
          <h1>받은 검사 결과</h1>
          <p>
            설문자를 찾고, 결과를 확인하세요. 상담에 필요한 문항 응답은 TXT
            파일로 저장할 수 있습니다.
          </p>
        </div>
        {requiresAccessKey ? (
          <section className="rd-state rd-lock" aria-labelledby="access-title">
            <KeyRound size={28} aria-hidden="true" />
            <p className="rd-eyebrow">보호된 상담 기록</p>
            <h2 id="access-title">접근키를 입력해 주세요</h2>
            <p>
              개인정보 보호를 위해 결과 조회 권한을 확인합니다.
              <br />
              관리자에게 전달받은 접근키로 결과를 열 수 있습니다.
            </p>
            <form onSubmit={handleAccessKeySubmit}>
              <label htmlFor="result-access-key">결과 조회 접근키</label>
              <div className="rd-key-row">
                <Input
                  id="result-access-key"
                  type="password"
                  value={pendingAccessKey}
                  onChange={event => setPendingAccessKey(event.target.value)}
                  placeholder="접근키 입력"
                  autoFocus
                />
                <Button type="submit" disabled={isLoading}>
                  <Eye size={16} aria-hidden="true" />
                  {isLoading ? "확인 중…" : "결과 열기"}
                </Button>
              </div>
            </form>
          </section>
        ) : (
          <>
            <div className="rd-status" aria-live="polite">
              <span>
                <ShieldCheck size={17} aria-hidden="true" />
                {isLoading
                  ? "조회 권한 확인 중"
                  : hasFullAccess
                    ? "전체 조회 · 전화번호 전체 표시"
                    : "접근 제한 · 개인정보와 문항 응답 보호"}
              </span>
              {!isLoading && !loadError && (
                <span>
                  전체 수신 <strong>{total}건</strong>
                  {latestSubmission && (
                    <> · 최근 {formatDate(latestSubmission.createdAt)}</>
                  )}
                </span>
              )}
            </div>
            <section className="rd-toolbar" aria-label="결과 검색">
              <label htmlFor="result-search">결과 찾기</label>
              <div className="rd-search-row">
                <div className="rd-search-input">
                  <Search size={18} aria-hidden="true" />
                  <Input
                    id="result-search"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder="이름, 상담사, 전화번호, 유형명 검색"
                    aria-describedby="result-search-help"
                  />
                </div>
                {query && (
                  <Button variant="outline" onClick={() => setQuery("")}>
                    검색 지우기
                  </Button>
                )}
              </div>
              <p id="result-search-help">
                불러온 {submissions.length}건 안에서 검색합니다. 한 번에 최대
                300건을 조회합니다.
              </p>
            </section>
            {loadError && (
              <div className="rd-error" role="alert">
                <strong>결과를 불러오지 못했습니다.</strong>
                <p>{loadError}</p>
                <p>
                  이전에 불러온 목록이 있다면 그대로 표시됩니다. 새로고침으로
                  다시 시도해 주세요.
                </p>
                <Button variant="outline" onClick={() => loadSubmissions()}>
                  다시 시도
                </Button>
              </div>
            )}
            {isLoading ? (
              <div className="rd-state" role="status">
                <Loader2 className="animate-spin" aria-hidden="true" />
                <h2>결과를 불러오고 있습니다</h2>
                <p>조회 권한과 수신된 기록을 확인하고 있어요.</p>
              </div>
            ) : filteredSubmissions.length === 0 ? (
              !loadError && (
                <div className="rd-state">
                  <UserCheck size={30} aria-hidden="true" />
                  <h2>
                    {submissions.length === 0
                      ? "아직 받은 검사 결과가 없습니다"
                      : "일치하는 결과가 없습니다"}
                  </h2>
                  <p>
                    {submissions.length === 0
                      ? "설문자가 검사 결과 화면에서 ‘상담사에게 보내기’를 누르면 이곳에 표시됩니다."
                      : "이름이나 전화번호 일부로 다시 검색하거나 검색어를 지워 보세요."}
                  </p>
                  {query && (
                    <Button variant="outline" onClick={() => setQuery("")}>
                      전체 목록 보기
                    </Button>
                  )}
                </div>
              )
            ) : (
              <section
                aria-labelledby="result-list-title"
                className="rd-results"
              >
                <div className="rd-list-heading">
                  <h2 id="result-list-title">
                    {query ? "검색 결과" : "수신 목록"}{" "}
                    <span>{filteredSubmissions.length}건</span>
                  </h2>
                  <p>한 장 요약: PDF·PNG · 문항 응답: TXT · 원본: JSON</p>
                </div>
                {filteredSubmissions.map(submission => (
                  <article
                    key={submission.id}
                    className="rd-record"
                    aria-label={`${submission.participant.name || "이름 없음"} 검사 결과`}
                  >
                    <div className="rd-record-top">
                      <div className="rd-person">
                        <p className="rd-label">설문자</p>
                        <h3>
                          {submission.participant.name || "이름 없음"}
                          <span>
                            {submission.participant.age !== null &&
                              `만 ${submission.participant.age}세`}
                          </span>
                        </h3>
                        <time dateTime={submission.createdAt}>
                          수신 {formatDate(submission.createdAt)}
                        </time>
                      </div>
                      <div className="rd-type">
                        <p className="rd-label">주유형</p>
                        <strong>
                          {submission.result.primaryType}유형 ·{" "}
                          {submission.result.primaryTypeName}
                        </strong>
                        <p>
                          날개 {submission.result.wingCode} ·{" "}
                          {submission.result.wingName}
                        </p>
                      </div>
                      <div className="rd-downloads">
                        <ReportDownloadButtons
                          submission={submission}
                          hasFullAccess={hasFullAccess}
                        />
                        <TxtDownloadButton
                          submission={submission}
                          hasFullAccess={hasFullAccess}
                        />
                        <Button
                          variant="ghost"
                          disabled={!hasFullAccess}
                          onClick={() =>
                            downloadJson(submission, hasFullAccess)
                          }
                        >
                          JSON 다운로드
                        </Button>
                      </div>
                    </div>
                    <dl className="rd-contact">
                      <div>
                        <dt>담당 상담사</dt>
                        <dd>{submission.counselorName || "정보 없음"}</dd>
                      </div>
                      <div>
                        <dt>전화번호</dt>
                        <dd>{submission.respondentPhone || "정보 없음"}</dd>
                      </div>
                    </dl>
                    {!hasFullAccess && (
                      <p className="rd-restricted">
                        접근 제한 상태에서는 다운로드할 수 없습니다.
                      </p>
                    )}
                    <details className="rd-details">
                      <summary>결과 설명과 유형별 점수 보기</summary>
                      <div className="rd-detail-body">
                        <div className="rd-report">
                          <p className="rd-label">저장된 결과 설명</p>
                          <h4>
                            {submission.result.report?.tagline ??
                              submission.result.wingTitle}
                          </h4>
                          <p>
                            {submission.result.report?.summary ??
                              submission.result.wingTitle}
                          </p>
                        </div>
                        <h4>유형별 점수</h4>
                        <p className="rd-help">
                          전송 당시 저장된 점수와 순서입니다. 여기서 다시
                          계산하지 않습니다.
                        </p>
                        {submission.result.rankedTypes.length ? (
                          <ol className="rd-scores">
                            {submission.result.rankedTypes.map(
                              (item, index) => (
                                <li key={`${submission.id}-${item.type}`}>
                                  <span className="rd-rank">{index + 1}위</span>
                                  <span>
                                    {item.type}유형 {item.name}
                                  </span>
                                  <strong>{item.score}점</strong>
                                </li>
                              )
                            )}
                          </ol>
                        ) : (
                          <p className="rd-help">
                            저장된 유형별 순위가 없습니다.
                          </p>
                        )}
                        {submission.result.centers.length > 0 && (
                          <>
                            <h4>중심별 점수</h4>
                            <ul className="rd-centers">
                              {submission.result.centers.map(center => (
                                <li key={center.label}>
                                  <strong>{center.label}</strong>
                                  <span>{center.theme}</span>
                                  <span>
                                    {center.score}점 · {center.percent}%
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    </details>
                    <GroupedAnswerDetails
                      answers={submission.answers}
                      hasFullAccess={hasFullAccess}
                    />
                  </article>
                ))}
              </section>
            )}
          </>
        )}
        <footer className="rd-footer">
          상담 기록에는 개인정보가 포함되어 있습니다. 다운로드한 파일은 안전하게
          보관해 주세요.
        </footer>
      </main>
    </div>
  );
}
