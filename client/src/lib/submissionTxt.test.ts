import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResultSubmission } from "@shared/resultSubmissions";
import { QUESTIONS } from "./questions";
import { buildSubmissionTxt, downloadTxt } from "./submissionTxt";

const sample: ResultSubmission = {
  id: "00000000-0000-4000-8000-000000000000", createdAt: "2026-01-01T00:00:00Z", blobPathname: "synthetic-only",
  counselorName: "가상 상담사 (예시)", respondentPhone: "", participant: { name: "가상 설문자 (예시)", birthDate: "", age: null },
  answers: Object.fromEntries(QUESTIONS.map(q => [q.id, 5])),
  result: { primaryType: 1, primaryTypeName: "예시 유형", primaryTypeTitle: "예시", wingType: 9, wingCode: "1w9", wingName: "예시 날개", wingTitle: "예시", typeScores: { 1: 45 }, rankedTypes: [], centers: [], report: null },
};
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Korean TXT export (synthetic only)", () => {
  it("exports actual UTF-8 BOM Blob, MIME, safe UUID/date name, and canonical 81 rows once", async () => {
    const before = JSON.stringify(sample);
    const exported = buildSubmissionTxt(sample, true)!;
    expect(exported.filename).toBe("mind-compass-result-2026-01-01-00000000-0000-4000-8000-000000000000.txt");
    expect(exported.blob.type).toBe("text/plain;charset=utf-8");
    expect([...new Uint8Array(await exported.blob.arrayBuffer()).slice(0, 3)]).toEqual([239, 187, 191]);
    const text = await exported.blob.text();
    expect(text.match(/^애니어 [1-9]번$/gm)).toEqual(Array.from({ length: 9 }, (_, i) => `애니어 ${i + 1}번`));
    const rows = text.split(/\r?\n/).filter(line => /^\d+\. /.test(line));
    expect(rows).toHaveLength(81);
    expect(new Set(rows.map(line => line.split(".")[0])).size).toBe(81);
    for (const q of QUESTIONS) expect(rows).toContain(`${q.id}. ${q.text} - 5점`);
    expect(text).toContain("애니어 1번\r\n\r\n3. 나는 모든 일을 개선하기 위해 깊이 생각해서 행동한다. - 5점");
    expect(text).toContain("설문자: 가상 설문자 (예시)");
    expect(text).toContain("전화번호: 미응답");
    expect(text).not.toContain("blobPathname");
    expect(JSON.stringify(sample)).toBe(before);
  });

  it("marks missing/invalid and separates unknown IDs literally without inferred questions", async () => {
    const answers = { 3: 5, 1: "5", "003": 2, "old-id": null, "999": "bad" } as unknown as ResultSubmission["answers"];
    const text = await buildSubmissionTxt({ ...sample, answers }, true)!.blob.text();
    expect(text).toContain(`1. ${QUESTIONS.find(q => q.id === 1)!.text} - 확인 필요`);
    expect(text).toContain(`2. ${QUESTIONS.find(q => q.id === 2)!.text} - 미응답`);
    const unknown = text.split("분류되지 않은 기존 응답")[1];
    expect(unknown).toContain("ID 003. 문항 정보 없음 - 2점");
    expect(unknown).toContain("ID old-id. 문항 정보 없음 - 미응답");
    expect(unknown).toContain("ID 999. 문항 정보 없음 - 확인 필요");
    expect(text).not.toContain("bad");
  });

  it("handles empty/absent legacy answers and sanitizes unsafe file components", async () => {
    for (const answers of [{}, undefined, null]) {
      const exported = buildSubmissionTxt({ ...sample, id: "../../unsafe/name", createdAt: "../bad", answers } as unknown as ResultSubmission, true)!;
      expect(exported.filename).toMatch(/^mind-compass-result-unknown-date-[a-zA-Z0-9_-]+\.txt$/);
      expect((await exported.blob.text()).match(/ - 미응답/g)).toHaveLength(81);
    }
  });

  it("blocks helper and action before reading restricted stale data", () => {
    const guarded = { get answers() { throw new Error("must not read"); } } as unknown as ResultSubmission;
    const create = vi.spyOn(URL, "createObjectURL");
    expect(buildSubmissionTxt(guarded, false)).toBeNull();
    downloadTxt(guarded, false);
    expect(create).not.toHaveBeenCalled();
  });

  it("downloads actual helper Blob and revokes the object URL", async () => {
    let blob: Blob | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation(value => { blob = value as Blob; return "blob:txt-example"; });
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const link = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("document", { createElement: vi.fn(() => link) });
    downloadTxt(sample, true);
    expect(link.click).toHaveBeenCalledOnce();
    expect(link.href).toBe("blob:txt-example");
    expect(link.download).toBe(buildSubmissionTxt(sample, true)!.filename);
    expect(await blob!.arrayBuffer()).toEqual(await buildSubmissionTxt(sample, true)!.blob.arrayBuffer());
    expect(revoke).toHaveBeenCalledWith("blob:txt-example");
  });

  it("revokes the object URL even if the click fails", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:txt-error");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.stubGlobal("document", { createElement: () => ({ click: () => { throw new Error("click failed"); } }) });
    expect(() => downloadTxt(sample, true)).toThrow("click failed");
    expect(revoke).toHaveBeenCalledWith("blob:txt-error");
  });
});
