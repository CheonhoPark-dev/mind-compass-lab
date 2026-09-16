import {
  MISSING,
  REPORT_NOTICE,
  scoreAxis,
  scoreLabel,
  type ReportModel,
} from "./model";

// All layout coordinates and typography are A4 points, independent of PNG resolution.
export const PAGE = { width: 595.28, height: 841.89, margin: 34.02 };
export const FONT_FAMILY = "MindLabReport";
export const INK = "#252a29";
const GREEN = "#174b46";
const MUTED = "#626d69";
export type MeasureText = (text: string, size: number, bold: boolean) => number;
type Run = { text: string; bold: boolean };
export type TextCommand = Run & {
  kind: "text";
  x: number;
  y: number;
  size: number;
  color: string;
  width: number;
};
type ShapeCommand = {
  kind: "rect" | "line";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  role?: string;
};
export type ReportLayout = {
  commands: (TextCommand | ShapeCommand)[];
  bottom: number;
  sectionCount: number;
  bodySize: number;
};

const graphemes = (value: string) =>
  Array.from(
    new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(value),
    s => s.segment
  );

/** Word wrap, with grapheme-safe breaking for a single overlong name/token. */
export function wrapText(
  text: string,
  width: number,
  size: number,
  measure: MeasureText,
  highlight = "",
  bold = false
): Run[][] {
  const start = highlight ? text.indexOf(highlight) : -1;
  if (
    highlight &&
    (start < 0 || text.indexOf(highlight, start + highlight.length) !== -1)
  ) {
    throw new Error("유형 해설의 강조 문구를 확인해 주세요.");
  }
  const runs: Run[] =
    start < 0
      ? [{ text, bold }]
      : [
          { text: text.slice(0, start), bold },
          { text: highlight, bold: true },
          { text: text.slice(start + highlight.length), bold },
        ];
  const lines: Run[][] = [];
  let line: Run[] = [];
  let used = 0;
  const flush = () => {
    while (line.length && !line[line.length - 1].text.trim()) line.pop();
    if (line.length) lines.push(line);
    line = [];
    used = 0;
  };
  const append = (value: string, weight: boolean) => {
    if (!line.length && !value.trim()) return;
    const w = measure(value, size, weight);
    if (used + w > width + 0.01) flush();
    if (!line.length && !value.trim()) return;
    line.push({ text: value, bold: weight });
    used += w;
  };
  for (const run of runs) {
    for (const token of run.text.match(/\S+|\s+/g) ?? []) {
      if (measure(token, size, run.bold) <= width) append(token, run.bold);
      else
        for (const char of graphemes(token)) {
          if (measure(char, size, run.bold) > width)
            throw new Error("보고서에 표시할 수 없는 문자가 있습니다.");
          append(char, run.bold);
        }
    }
  }
  flush();
  return lines;
}

export function layoutReport(
  model: ReportModel,
  measure: MeasureText
): ReportLayout {
  const commands: ReportLayout["commands"] = [];
  const left = PAGE.margin,
    width = PAGE.width - left * 2,
    right = PAGE.width - left;
  const text = (
    value: string,
    x: number,
    y: number,
    size = 10.5,
    bold = false,
    color = INK
  ) => {
    const w = measure(value, size, bold);
    commands.push({
      kind: "text",
      text: value,
      x,
      y,
      size,
      bold,
      color,
      width: w,
    });
  };
  const rule = (y: number, role?: string, x = left, w = width) =>
    commands.push({
      kind: "line",
      x,
      y,
      width: w,
      height: 0,
      color: "#bdc8c4",
      role,
    });
  const paragraph = (
    value: string,
    x: number,
    y: number,
    w: number,
    size = 10.5,
    lineHeight = 15,
    highlight = "",
    bold = false,
    color = INK
  ) => {
    const lines = wrapText(value, w, size, measure, highlight, bold);
    for (const line of lines) {
      let cursor = x;
      for (const run of line) {
        text(run.text, cursor, y, size, run.bold, color);
        cursor += measure(run.text, size, run.bold);
      }
      y += lineHeight;
    }
    return y;
  };
  let y = left;
  text("마인드랩  |  애니어그램 결과 요약", left, y, 16, true, GREEN);
  y += 26;
  const metadata = [
    `이름  ${model.participantName}`,
    `제출일  ${model.submittedDate}`,
  ];
  if (model.counselorName !== MISSING)
    metadata.push(`상담사  ${model.counselorName}`);
  y = paragraph(metadata.join("    ·    "), left, y, width);
  y += 7;
  rule(y, "header");
  y += 10;

  const chartWidth = 322,
    axisWidth = 26,
    slot = (chartWidth - axisWidth) / 9;
  const plotTop = y + 17,
    plotHeight = 55,
    plotBottom = plotTop + plotHeight;
  const axis = scoreAxis(model.scores);
  const chartY = (value: number) =>
    plotBottom - axis.position(value) * plotHeight;
  const zero = chartY(0);
  // For unusually long exact numeric strings, show the values in a wrapped key below.
  const separateKey =
    model.scores.some(
      s => measure(scoreLabel(s.score), 10.5, false) > slot - 1
    ) ||
    [axis.min, axis.max].some(
      v => measure(String(v), 10.5, false) > axisWidth - 3
    );
  // Wide axis labels go above/below the plot; their numeric value remains explicit.
  const axisTop = String(axis.max),
    axisBottom = String(axis.min);
  text(axisTop, left, y, 10.5, false, MUTED);
  text(axisBottom, left, plotBottom + 3, 10.5, false, MUTED);
  rule(zero, "baseline", left + axisWidth, chartWidth - axisWidth);
  for (const [i, s] of Array.from(model.scores.entries())) {
    const center = left + axisWidth + slot * (i + 0.5);
    const selected = s.type === model.primaryType;
    if (s.score !== null) {
      const endpoint = chartY(s.score);
      commands.push({
        kind: "rect",
        x: center - 9,
        y: Math.min(zero, endpoint),
        width: 18,
        height: Math.abs(endpoint - zero),
        color: selected ? GREEN : "#b8c3bf",
        role: `score-${s.type}`,
      });
    }
    if (!separateKey) {
      const label = scoreLabel(s.score);
      text(
        label,
        center - measure(label, 10.5, false) / 2,
        s.score === null
          ? plotTop + 20
          : s.score >= 0
            ? chartY(s.score) - 15
            : chartY(s.score) + 1,
        10.5,
        false,
        selected ? GREEN : MUTED
      );
    }
    text(
      String(s.type),
      center - measure(String(s.type), 10.5, selected) / 2,
      plotBottom + 17,
      10.5,
      selected,
      selected ? GREEN : MUTED
    );
  }
  text(
    "유형별 응답 점수",
    left + 8,
    plotBottom + 34,
    10.5,
    false,
    MUTED
  );
  const asideX = left + chartWidth + 17,
    asideWidth = right - asideX;
  text("대표 유형", asideX, y, 10.5, false, MUTED);
  text(
    model.primaryType === null ? MISSING : `${model.primaryType}유형`,
    asideX,
    y + 20,
    21,
    true,
    GREEN
  );
  text(`날개 ${model.wingCode}`, asideX + 65, y + 29, 10.5, true, GREEN);
  let asideY = paragraph(
    model.primaryScore === null
      ? "원점수 미기록"
      : `${scoreLabel(model.primaryScore)}점`,
    asideX,
    y + 51,
    asideWidth,
    13,
    18,
    "",
    true,
    GREEN
  );
  if (model.template)
    asideY = paragraph(
      model.template.keywords.join(" · "),
      asideX,
      asideY + 3,
      asideWidth,
      10.5,
      15,
      "",
      false,
      GREEN
    );
  if (model.primaryNote)
    asideY = paragraph(
      model.primaryNote,
      asideX,
      asideY + 3,
      asideWidth,
      10.5,
      15,
      "",
      false,
      MUTED
    );
  y = Math.max(plotBottom + 54, asideY + 10);
  if (separateKey)
    y =
      paragraph(
        model.scores
          .map(
            s =>
              `${s.type}유형 ${scoreLabel(s.score)}${s.score === null ? "" : "점"}`
          )
          .join(" · "),
        left,
        y,
        width
      ) + 5;
  y =
    paragraph(
      "유형 이론에 따른 참고 해설 · 실제 경험과 함께 살펴보세요.",
      left,
      y,
      width,
      10.5,
      15,
      "",
      false,
      MUTED
    ) + 9;

  const sections = model.template?.sections ?? [
    {
      heading: "유형 해설 안내",
      text: "저장된 대표 유형이 없거나 형식을 확인할 수 없어 유형별 해설을 표시하지 않았습니다. 저장된 결과를 확인해 주세요. 점수만으로 대표 유형이나 날개를 다시 정하지 않습니다.",
      highlight: "저장된 결과를 확인",
    },
  ];
  const lowHeading =
    model.lowType === null
      ? "낮은 유형에서 살펴볼 점 · 미기록"
      : `낮은 유형에서 살펴볼 점 · ${model.lowType}유형 ${scoreLabel(model.lowScore)}점`;
  const lowHeight =
    wrapText(lowHeading, width, 10.5, measure, "", true).length * 15 +
    (model.lowSelectionNote
      ? wrapText(model.lowSelectionNote, width, 10.5, measure).length * 15
      : 0) +
    wrapText(model.lowNote, width, 10.5, measure).length * 15 +
    25;
  const footerHeight =
    wrapText(REPORT_NOTICE, width, 10.5, measure).length * 15;
  const bottomLimit = PAGE.height - PAGE.margin;
  // Select the largest measured print size that fits. All text remains >=10.5pt,
  // including long names plus tie notes; no content is discarded to make room.
  const typography = [
    { bodySize: 11.5, bodyLine: 16.4 },
    { bodySize: 11, bodyLine: 15.8 },
    { bodySize: 10.5, bodyLine: 15.2 },
  ]
    .map(style => {
      const bodyHeight = sections.reduce(
        (sum, s) =>
          sum +
          19 +
          wrapText(s.text, width, style.bodySize, measure, s.highlight).length *
            style.bodyLine,
        0
      );
      return {
        ...style,
        availableGap:
          (bottomLimit - y - bodyHeight - lowHeight - footerHeight - 28) /
          Math.max(1, sections.length - 1),
      };
    })
    .find(style => style.availableGap >= 8);
  if (!typography)
    throw new Error(
      "내용이 A4 한 페이지를 초과합니다. 이름 길이와 저장된 점수 형식을 확인해 주세요."
    );
  const { bodySize, bodyLine, availableGap } = typography;
  const gap = Math.min(19, availableGap);
  for (const [i, section] of Array.from(sections.entries())) {
    if (i) {
      y += gap / 2;
      rule(y, "section-separator");
      y += gap / 2;
    }
    text(section.heading, left, y, 11.5, true, GREEN);
    y = paragraph(
      section.text,
      left,
      y + 19,
      width,
      bodySize,
      bodyLine,
      section.highlight
    );
  }
  y = Math.max(y + 12, bottomLimit - lowHeight - footerHeight);
  rule(y, "low");
  y += 7;
  y = paragraph(lowHeading, left, y, width, 10.5, 15, "", true);
  if (model.lowSelectionNote)
    y = paragraph(
      model.lowSelectionNote,
      left,
      y,
      width,
      10.5,
      15,
      "",
      false,
      MUTED
    );
  y = paragraph(model.lowNote, left, y + 3, width);
  y += 8;
  rule(y, "footer");
  y += 7;
  y = paragraph(REPORT_NOTICE, left, y, width, 10.5, 15, "", false, MUTED);

  // Fail before rendering/download instead of clipping or shrinking unreadable text.
  if (
    y > bottomLimit + 0.1 ||
    commands.some(
      c =>
        ![c.x, c.y, c.width].every(Number.isFinite) ||
        c.x < left - 0.1 ||
        c.x + c.width > right + 0.1
    )
  ) {
    throw new Error(
      "보고서 내용을 한 페이지에 배치할 수 없습니다. 이름 길이와 저장된 점수 형식을 확인해 주세요."
    );
  }
  return { commands, bottom: y, sectionCount: sections.length, bodySize };
}
