import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { ResultSubmission } from "@shared/resultSubmissions";
import { ReportDownloadButtons } from "./ReportDownloadButtons";

it("puts both PDF and PNG behind the existing full-access gate", () => {
  for (const hasFullAccess of [false, true]) {
    const html = renderToStaticMarkup(
      createElement(ReportDownloadButtons, {
        submission: {} as ResultSubmission,
        hasFullAccess,
      })
    );
    expect(html).toContain('aria-label="PDF 다운로드"');
    expect(html).toContain('aria-label="PNG 다운로드"');
    expect(html.match(/disabled=""/g)?.length ?? 0).toBe(hasFullAccess ? 0 : 2);
  }
});
