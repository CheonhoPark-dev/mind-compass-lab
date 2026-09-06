import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResultSubmission } from "@shared/resultSubmissions";
import { downloadJson, GroupedAnswerDetails, TxtDownloadButton } from "./ResultsDashboard";

// Deliberately synthetic; no personal data or API requests.
const sampleSubmission: ResultSubmission = {
  id: "SYNTHETIC-ONLY", createdAt: "2026-01-01T00:00:00Z", blobPathname: "sample-only",
  counselorName: "TEST", respondentPhone: "", participant: { name: "TEST", birthDate: "", age: null },
  answers: { 3: 5, 999: 2 },
  result: { primaryType: 1, primaryTypeName: "TEST", primaryTypeTitle: "TEST", wingType: 9,
    wingCode: "1w9", wingName: "TEST", wingTitle: "TEST", typeScores: { 1: 5 }, rankedTypes: [], centers: [], report: null },
};

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("TXT button access boundary", () => {
  it("clearly labels TXT and disables it for restricted access", () => {
    for (const hasFullAccess of [false, true]) {
      const html = renderToStaticMarkup(createElement(TxtDownloadButton, { submission: sampleSubmission, hasFullAccess }));
      expect(html).toContain("TXT 다운로드");
      expect(html.includes('disabled=""')).toBe(!hasFullAccess);
      expect(html).not.toContain("SYNTHETIC-ONLY");
    }
  });
  it("rejects even a manually invoked restricted button handler", () => {
    const create = vi.spyOn(URL, "createObjectURL");
    const button = TxtDownloadButton({ submission: sampleSubmission, hasFullAccess: false });
    button.props.onClick();
    expect(create).not.toHaveBeenCalled();
  });
});

describe("JSON download boundary", () => {
  it("downloads the enriched JSON with raw answers and existing filename intact", async () => {
    let downloaded: Blob | undefined;
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockImplementation(blob => { downloaded = blob as Blob; return "blob:synthetic"; });
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const link = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("document", { createElement: vi.fn(() => link) });
    downloadJson(sampleSubmission, true);
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(link.click).toHaveBeenCalledOnce();
    expect(link.download).toBe("mind-compass-result-2026-01-01-SYNTHETIC-ONLY.json");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:synthetic");
    const payload = JSON.parse(await downloaded!.text());
    expect(payload.answers).toEqual(sampleSubmission.answers);
    expect(payload.result).toEqual(sampleSubmission.result);
    expect(payload.answersByType).toHaveLength(9);
    expect(payload.answersByType[0].answers[0]).toMatchObject({ questionId: 3, score: 5 });
    expect(payload.unknownAnswers).toEqual([{ questionId: "999", score: 2 }]);
  });
  it("does not create a download when access is restricted", () => {
    const createObjectURL = vi.spyOn(URL, "createObjectURL");
    downloadJson(sampleSubmission, false);
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

describe("grouped answer viewer (synthetic only)", () => {
  it("renders canonical text, original id and score in nine groups", () => {
    const html = renderToStaticMarkup(createElement(GroupedAnswerDetails, { answers: { 3: 5, 999: 2 }, hasFullAccess: true }));
    expect(html).toContain("3. 나는 모든 일을 개선하기 위해 깊이 생각해서 행동한다. - 5점");
    expect(html.match(/애니어 \d번/g)).toHaveLength(9);
    expect(html).toContain("미응답");
    expect(html).toContain("999. 문항 정보 없음 - 2점");
  });
  it("does not render answers or canonical details for restricted access", () => {
    const html = renderToStaticMarkup(createElement(GroupedAnswerDetails, { answers: { 3: 5, 999: 2 }, hasFullAccess: false }));
    expect(html).toContain("문항별 응답은 전체 조회 권한이 필요합니다.");
    expect(html).not.toContain("개선하기");
    expect(html).not.toContain("5점");
    expect(html).not.toContain("999");
    expect(html).not.toContain("애니어 1번");
  });
});
