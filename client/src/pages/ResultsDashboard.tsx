import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ResultSubmission, ResultSubmissionListResponse } from "@shared/resultSubmissions";
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

function downloadJson(submission: ResultSubmission) {
  const blob = new Blob([JSON.stringify(submission, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `mind-compass-result-${submission.createdAt.slice(0, 10)}-${submission.id}.json`;
  link.click();
  URL.revokeObjectURL(url);
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
  const [accessKeyConfigured, setAccessKeyConfigured] = useState(false);
  const [hasFullAccess, setHasFullAccess] = useState(false);
  const [query, setQuery] = useState("");

  const loadSubmissions = useCallback(
    async (key = accessKey) => {
      setIsLoading(true);

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
        setAccessKeyConfigured(result.accessKeyConfigured);
        setHasFullAccess(result.hasFullAccess);

        if (key) {
          sessionStorage.setItem(ACCESS_KEY_STORAGE_KEY, key);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "결과 목록을 불러오지 못했습니다.");
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

    return submissions.filter((submission) => {
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
    <div className="min-h-screen bg-grainy bg-background text-foreground antialiased">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="container max-w-6xl h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              window.location.href = "/";
            }}
            className="flex items-center gap-2 text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <Compass className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-sans font-extrabold text-base tracking-tight text-primary">
                마음나침반연구소
              </span>
              <span className="text-[10px] text-muted-foreground font-medium tracking-widest uppercase">
                Result Inbox
              </span>
            </div>
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadSubmissions()}
            disabled={isLoading || requiresAccessKey}
            className="h-9 rounded-lg gap-1.5 text-xs font-bold"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
            새로고침
          </Button>
        </div>
      </header>

      <main className="container max-w-6xl py-8 md:py-10 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 text-primary px-3 py-1">
              상담 결과 수신함
            </Badge>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
                상담사에게 전송된 검사 결과
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                결과 화면에서 보낸 설문자 정보와 애니어그램 분석 결과가 이곳에 모입니다.
              </p>
            </div>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="상담사, 이름, 전화번호 검색"
              className="h-11 rounded-xl border-border bg-card pl-9"
            />
          </div>
        </div>

        {requiresAccessKey && (
          <Card className="border-border bg-card shadow-md rounded-3xl overflow-hidden">
            <CardContent className="p-6 md:p-8 space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl border border-primary/20 bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-extrabold text-foreground">결과 조회 접근키가 필요합니다</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Vercel 환경변수 `RESULTS_ACCESS_KEY`에 설정된 키를 입력하면 저장된 결과를 확인할 수 있습니다.
                  </p>
                </div>
              </div>
              <form onSubmit={handleAccessKeySubmit} className="flex flex-col gap-3 sm:flex-row">
                <Input
                  type="password"
                  value={pendingAccessKey}
                  onChange={(event) => setPendingAccessKey(event.target.value)}
                  placeholder="접근키 입력"
                  className="h-12 rounded-xl border-border bg-background"
                  autoFocus
                />
                <Button
                  type="submit"
                  className="h-12 rounded-xl bg-primary px-6 font-bold text-primary-foreground hover:bg-primary/90"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  결과 열기
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {!requiresAccessKey && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="rounded-3xl border-border bg-card shadow-sm">
                <CardContent className="p-5">
                  <p className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Total</p>
                  <p className="text-3xl font-extrabold text-primary mt-2">{total}</p>
                  <p className="text-xs text-muted-foreground mt-1">Blob에 저장된 전체 제출 수</p>
                </CardContent>
              </Card>
              <Card className="rounded-3xl border-border bg-card shadow-sm">
                <CardContent className="p-5">
                  <p className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Latest</p>
                  <p className="text-lg font-extrabold text-foreground mt-2">
                    {latestSubmission ? formatDate(latestSubmission.createdAt) : "아직 없음"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">가장 최근 수신 시간</p>
                </CardContent>
              </Card>
              <Card className="rounded-3xl border-border bg-card shadow-sm">
                <CardContent className="p-5">
                  <p className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Access</p>
                  <div className="mt-2 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    <p className="text-lg font-extrabold text-foreground">
                      {hasFullAccess ? "전체 조회" : accessKeyConfigured ? "제한됨" : "마스킹"}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {hasFullAccess
                      ? "전화번호 전체 표시 중"
                      : "전화번호는 끝 4자리만 표시됩니다"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {isLoading ? (
              <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-sm">
                <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
                <p className="text-sm font-bold text-muted-foreground">결과를 불러오는 중입니다.</p>
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-sm">
                <UserCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-base font-extrabold text-foreground">
                  {submissions.length === 0 ? "아직 저장된 결과가 없습니다." : "검색 결과가 없습니다."}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  결과 화면에서 상담사에게 보내기를 누르면 이 목록에 추가됩니다.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSubmissions.map((submission) => (
                  <Card key={submission.id} className="rounded-3xl border-border bg-card shadow-sm overflow-hidden">
                    <CardContent className="p-5 md:p-6">
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-4 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="rounded-full bg-primary text-primary-foreground">
                              {submission.result.wingCode}
                            </Badge>
                            <Badge variant="outline" className="rounded-full border-accent/30 bg-accent/10 text-accent">
                              {submission.result.wingName}
                            </Badge>
                            <span className="text-xs font-semibold text-muted-foreground">
                              {formatDate(submission.createdAt)}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="rounded-2xl border border-border/70 bg-background p-3">
                              <p className="text-[11px] font-extrabold text-muted-foreground">담당 상담사</p>
                              <p className="text-sm font-bold text-foreground mt-1">{submission.counselorName}</p>
                            </div>
                            <div className="rounded-2xl border border-border/70 bg-background p-3">
                              <p className="text-[11px] font-extrabold text-muted-foreground">설문자</p>
                              <p className="text-sm font-bold text-foreground mt-1">
                                {submission.participant.name || "이름 없음"}
                                {submission.participant.age !== null && ` · 만 ${submission.participant.age}세`}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-border/70 bg-background p-3">
                              <p className="text-[11px] font-extrabold text-muted-foreground">전화번호</p>
                              <p className="text-sm font-bold text-foreground mt-1">{submission.respondentPhone}</p>
                            </div>
                            <div className="rounded-2xl border border-border/70 bg-background p-3">
                              <p className="text-[11px] font-extrabold text-muted-foreground">주유형</p>
                              <p className="text-sm font-bold text-foreground mt-1">
                                {submission.result.primaryType}유형 {submission.result.primaryTypeName}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                            <p className="text-sm font-extrabold text-primary">
                              {submission.result.report?.tagline ?? submission.result.wingTitle}
                            </p>
                            <p className="text-xs leading-relaxed text-muted-foreground mt-2 line-clamp-2">
                              {submission.result.report?.summary ?? submission.result.wingTitle}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {submission.result.rankedTypes.slice(0, 5).map((item, index) => (
                              <span
                                key={`${submission.id}-${item.type}`}
                                className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-bold text-muted-foreground"
                              >
                                {index + 1}위 · {item.type}유형 {item.score}점
                              </span>
                            ))}
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => downloadJson(submission)}
                          className="h-11 rounded-xl gap-2 text-xs font-bold lg:w-32"
                        >
                          <Download className="w-4 h-4 text-primary" />
                          JSON 저장
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
