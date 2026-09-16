import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ResultSubmission } from "@shared/resultSubmissions";
import type { ReportFormat } from "@/lib/report/download";

export function ReportDownloadButtons({
  submission,
  hasFullAccess,
}: {
  submission: ResultSubmission;
  hasFullAccess: boolean;
}) {
  const [busy, setBusy] = useState<ReportFormat | null>(null);
  const inFlight = useRef(false);
  const allowed = useRef(hasFullAccess);
  allowed.current = hasFullAccess;
  useEffect(() => {
    allowed.current = hasFullAccess;
    return () => {
      allowed.current = false;
    };
  }, [hasFullAccess]);

  const handleDownload = async (format: ReportFormat) => {
    if (!hasFullAccess || !allowed.current || inFlight.current) return;
    inFlight.current = true;
    setBusy(format);
    try {
      const { downloadReport } = await import("@/lib/report/download");
      await downloadReport(
        submission,
        format,
        hasFullAccess,
        () => allowed.current
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "보고서를 만들지 못했습니다. 다시 시도해 주세요."
      );
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  return (
    <div className="rd-report-downloads" aria-busy={busy !== null}>
      {(["pdf", "png"] as const).map(format => (
        <Button
          key={format}
          type="button"
          variant="outline"
          disabled={!hasFullAccess || busy !== null}
          onClick={() => handleDownload(format)}
          className="h-11 gap-2"
          aria-label={`${format.toUpperCase()} 다운로드`}
        >
          {busy === format ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-4 w-4" aria-hidden="true" />
          )}
          {busy === format
            ? `${format.toUpperCase()} 생성 중`
            : `${format.toUpperCase()} 다운로드`}
        </Button>
      ))}
      <span className="sr-only" role="status">
        {busy ? "보고서를 만들고 있습니다." : ""}
      </span>
    </div>
  );
}
