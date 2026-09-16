import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResultSubmission } from "@shared/resultSubmissions";
import {
  buildReportModel,
  MISSING,
  scoreAxis,
  TYPE_EXPLANATIONS,
} from "./model";
import { layoutReport, PAGE, wrapText, type MeasureText } from "./layout";
import {
  createReportDownload,
  downloadReport,
  saveReportBlob,
  URL_LIFETIME_MS,
} from "./download";

function submission(
  result: Partial<ResultSubmission["result"]> = {}
): ResultSubmission {
  return {
    id: "PRIVATE-ID",
    blobPathname: "PRIVATE-PATH",
    respondentPhone: "PRIVATE-PHONE",
    participant: { name: "홍길동", birthDate: "PRIVATE-BIRTH", age: 30 },
    counselorName: "상담사",
    createdAt: "2026-01-01T23:30:00Z",
    answers: { 3: 99999 },
    result: {
      primaryType: 6,
      primaryTypeName: "",
      primaryTypeTitle: "",
      wingType: 7,
      wingCode: "6w5",
      wingName: "",
      wingTitle: "",
      report: null,
      centers: [],
      rankedTypes: [],
      typeScores: {
        1: 30,
        2: 31,
        3: 32,
        4: 20,
        5: 28,
        6: 42,
        7: 32,
        8: 0,
        9: 33,
      },
      ...result,
    },
  };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("stored report selection and privacy", () => {
  it("uses only stored typeScores and saved primary/wing, ignores answers/rank/wingType", () => {
    const source = submission({
      rankedTypes: [{ type: 9, score: 99999, name: "", title: "" }],
    });
    const before = JSON.stringify(source);
    const report = buildReportModel(source, true);
    expect(report.primaryType).toBe(6);
    expect(report.wingCode).toBe("6w5");
    expect(report.lowType).toBe(8);
    expect(report.lowScore).toBe(0);
    expect(report.scores).toHaveLength(9);
    expect(report.scores[7].score).toBe(0);
    expect(report.submittedDate).toBe("2026-01-02");
    expect(report.participantName).toBe("홍길동");
    expect(JSON.stringify(report)).not.toMatch(
      /PRIVATE-|99999|birthDate|respondentPhone|answers|blobPathname/
    );
    expect(report.filename).toBe("mindlab-result-2026-01-02");
    expect(JSON.stringify(source)).toBe(before);
  });
  it("honors the saved primary among tied maximums", () => {
    const model = buildReportModel(
      submission({
        primaryType: 9,
        wingCode: "9w1",
        typeScores: { 2: 45, 9: 45, 6: 20 },
      }),
      true
    );
    expect(model.primaryType).toBe(9);
    expect(model.template?.type).toBe(9);
    expect(model.primaryNote).toBe("공동 최고점 중 대표 유형");
    expect(model.wingCode).toBe("9w1");
  });
  it("does not replace a valid saved primary that differs from the highest score", () => {
    const model = buildReportModel(
      submission({ primaryType: 4, wingCode: "4w5" }),
      true
    );
    expect(model.primaryType).toBe(4);
    expect(model.primaryNote).toContain("최고점과 다름");
    expect(model.template?.type).toBe(4);
  });
  it.each([undefined, null, NaN, Infinity, 0, 10, 1.5, "6"])(
    "never invents invalid primary %s",
    value => {
      const model = buildReportModel(
        submission({ primaryType: value as number }),
        true
      );
      expect(model.primaryType).toBeNull();
      expect(model.template).toBeNull();
      expect(model.wingCode).toBe(MISSING);
      expect(model.primaryNote).toContain("안내");
    }
  );
  it.each([
    "6w4",
    "6w6",
    "5w6",
    "6w9",
    "06w5",
    "6W5",
    "6w5 ",
    "",
    null,
    undefined,
  ])("rejects invalid wing %s", wingCode => {
    expect(
      buildReportModel(submission({ wingCode: wingCode as string }), true)
        .wingCode
    ).toBe(MISSING);
  });
  it.each([
    [1, "1w9"],
    [1, "1w2"],
    [9, "9w1"],
    [9, "9w8"],
    [6, "6w7"],
  ])("accepts circular adjacent wing %s %s", (primaryType, wingCode) => {
    expect(
      buildReportModel(
        submission({
          primaryType: primaryType as number,
          wingCode: wingCode as string,
        }),
        true
      ).wingCode
    ).toBe(wingCode);
  });
  it("keeps zero, negative and fractional finite numbers; missing/nonfinite are not zero", () => {
    const model = buildReportModel(
      submission({
        typeScores: {
          1: 0,
          2: NaN,
          3: Infinity,
          4: -Infinity,
          5: "9" as unknown as number,
          6: -2.5,
        },
      }),
      true
    );
    expect(model.scores.map(s => s.score)).toEqual([
      0,
      null,
      null,
      null,
      null,
      -2.5,
      null,
      null,
      null,
    ]);
    expect(model.lowType).toBe(6);
    expect(model.lowSelectionNote).toContain("미기록 제외");
  });
  it("handles no scores and deterministically resolves all-zero low ties", () => {
    for (const typeScores of [undefined, {}]) {
      const model = buildReportModel(submission({ typeScores }), true);
      expect(model.scores.every(s => s.score === null)).toBe(true);
      expect(model.lowType).toBeNull();
      expect(model.primaryScore).toBeNull();
    }
    const model = buildReportModel(
      submission({
        typeScores: Object.fromEntries(
          Array.from({ length: 9 }, (_, i) => [i + 1, 0])
        ),
      }),
      true
    );
    expect(model.primaryType).toBe(6);
    expect(model.primaryNote).toContain("공동 최고점");
    expect(model.lowType).toBe(1);
    expect(model.lowScore).toBe(0);
    expect(model.lowSelectionNote).toContain("작은 유형 번호");
    expect(model.lowNote).toBe(TYPE_EXPLANATIONS[0].lowNote);
  });
  it("marks invalid dates and bounds names without truncating them", () => {
    const s = submission();
    s.createdAt = "invalid";
    expect(buildReportModel(s, true).submittedDate).toBe(MISSING);
    s.createdAt = "2026-02-30T00:00:00Z";
    expect(buildReportModel(s, true).submittedDate).toBe(MISSING);
    s.participant.name = "가".repeat(80);
    expect(buildReportModel(s, true).participantName).toHaveLength(80);
    s.participant.name += "가";
    expect(() => buildReportModel(s, true)).toThrow("80자");
  });
});

describe("common raw-score axis", () => {
  it.each(
    [
      [0],
      [27, 45],
      [75, 120],
      [-10, 0, 12],
      [Number.MAX_VALUE, -Number.MAX_VALUE],
      [Number.MIN_VALUE],
    ].map(values => ({ values }))
  )(
    "has finite coordinates and a common range covering $values",
    ({ values }) => {
      const scores = (values as number[]).map((score, i) => ({
        type: i + 1,
        score,
      }));
      const axis = scoreAxis(scores);
      expect(axis.max).toBeGreaterThanOrEqual(Math.max(...values));
      expect(axis.min).toBeLessThanOrEqual(Math.min(...values));
      for (const score of values) {
        expect(Number.isFinite(axis.position(score))).toBe(true);
        expect(axis.position(score)).toBeGreaterThanOrEqual(0);
        expect(axis.position(score)).toBeLessThanOrEqual(1);
      }
    }
  );
});

// Deterministic approximation for unit layout contracts; browser QA uses the actual
// embedded font and checks all nine types, long names and downloaded artifacts.
const measure: MeasureText = (text, size) =>
  Array.from(text).reduce(
    (w, c) =>
      w +
      size *
        (/\s/.test(c)
          ? 0.224
          : c.charCodeAt(0) < 128
            ? 0.55
            : /[가-힣]/.test(c)
              ? 0.92
              : 1),
    0
  );
describe("one-page layout", () => {
  it.each(TYPE_EXPLANATIONS)(
    "fits type $type with 80-character names and nine tied zeros",
    template => {
      const source = submission({
        primaryType: template.type,
        wingCode: "",
        typeScores: Object.fromEntries(
          Array.from({ length: 9 }, (_, i) => [i + 1, 0])
        ),
      });
      source.participant.name = "가".repeat(80);
      source.counselorName = "나".repeat(80);
      const layout = layoutReport(buildReportModel(source, true), measure);
      expect(layout.sectionCount).toBe(5);
      expect(layout.bottom).toBeLessThanOrEqual(
        PAGE.height - PAGE.margin + 0.1
      );
      expect(layout.bodySize).toBeGreaterThanOrEqual(10.5);
      const printed = layout.commands
        .flatMap(c => (c.kind === "text" ? [c.text] : []))
        .join("");
      expect(printed).toContain(source.participant.name);
      expect(printed).toContain(source.counselorName);
    }
  );
  it.each(TYPE_EXPLANATIONS)(
    "fits type $type with all five full sections and four separators",
    template => {
      const model = buildReportModel(
        submission({
          primaryType: template.type,
          wingCode: `${template.type}w${template.type === 1 ? 9 : template.type - 1}`,
        }),
        true
      );
      const layout = layoutReport(model, measure);
      expect(layout.sectionCount).toBe(5);
      expect(
        layout.commands.filter(
          c => c.kind === "line" && c.role === "section-separator"
        )
      ).toHaveLength(4);
      expect(layout.bottom).toBeLessThanOrEqual(
        PAGE.height - PAGE.margin + 0.1
      );
      for (const c of layout.commands) {
        expect(c.x).toBeGreaterThanOrEqual(PAGE.margin - 0.1);
        expect(c.x + c.width).toBeLessThanOrEqual(
          PAGE.width - PAGE.margin + 0.1
        );
        if (c.kind === "text") expect(c.size).toBeGreaterThanOrEqual(10.5);
      }
      for (const section of template.sections) {
        expect(section.text.split(section.highlight)).toHaveLength(2);
        const lines = wrapText(
          section.text,
          PAGE.width - 2 * PAGE.margin,
          11.5,
          measure,
          section.highlight
        );
        expect(
          lines
            .flat()
            .map(r => r.text)
            .join("")
            .replace(/\s/g, "")
        ).toBe(section.text.replace(/\s/g, ""));
        expect(
          lines
            .flat()
            .filter(r => r.bold)
            .map(r => r.text)
            .join("")
            .replace(/\s/g, "")
        ).toBe(section.highlight.replace(/\s/g, ""));
      }
      expect(template.lowNote.match(/\./g)).toHaveLength(2);
    }
  );
  it("uses guidance when no saved primary exists", () => {
    const layout = layoutReport(
      buildReportModel(submission({ primaryType: 0, typeScores: {} }), true),
      measure
    );
    expect(layout.sectionCount).toBe(1);
    expect(
      layout.commands.some(
        c => c.kind === "text" && c.text === "유형 해설 안내"
      )
    ).toBe(true);
  });
  it("rejects overflow without clipping or changing type size", () => {
    const model = buildReportModel(submission(), true);
    model.participantName = "가".repeat(1000);
    expect(() => layoutReport(model, measure)).toThrow("한 페이지");
  });
});

describe("download guards and object URL lifecycle", () => {
  it("rejects restricted calls before touching source data, fonts, canvas or URLs", async () => {
    const privateSource = new Proxy({} as ResultSubmission, {
      get() {
        throw new Error("source was read");
      },
    });
    expect(() => buildReportModel(privateSource, false)).toThrow("권한");
    await expect(
      createReportDownload(privateSource, "png", false)
    ).rejects.toThrow("권한");
    await expect(downloadReport(privateSource, "pdf", false)).rejects.toThrow(
      "권한"
    );
    await expect(
      downloadReport(privateSource, "pdf", true, () => false)
    ).rejects.toThrow("권한");
    expect(() => saveReportBlob(new Blob(), "test.pdf", false)).toThrow("권한");
  });
  it("retains URL for a safe delay and removes the temporary link", () => {
    vi.useFakeTimers();
    const link = {
      href: "",
      download: "",
      style: { display: "" },
      click: vi.fn(),
      remove: vi.fn(),
    };
    vi.stubGlobal("document", {
      createElement: () => link,
      body: { appendChild: vi.fn() },
    });
    vi.stubGlobal("window", { setTimeout });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:report");
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    saveReportBlob(new Blob(["test"]), "mindlab-result-2026-01-01.png", true);
    expect(link.click).toHaveBeenCalledOnce();
    expect(link.remove).toHaveBeenCalledOnce();
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(URL_LIFETIME_MS);
    expect(revoke).toHaveBeenCalledWith("blob:report");
  });
});
