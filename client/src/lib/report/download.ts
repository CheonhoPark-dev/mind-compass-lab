import type { ResultSubmission } from "@shared/resultSubmissions";
import { buildReportModel } from "./model";
import {
  FONT_FAMILY,
  layoutReport,
  PAGE,
  type MeasureText,
  type ReportLayout,
} from "./layout";

export type ReportFormat = "pdf" | "png";
export const PNG_SIZE = { width: 2480, height: 3508 };
export const URL_LIFETIME_MS = 60_000;
let fontPromise: Promise<void> | undefined;

async function fontLoadWithTimeout<T>(loading: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      loading,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("font timeout")), 30_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function loadReportFonts(): Promise<void> {
  if (!fontPromise) {
    fontPromise = (async () => {
      const faces = await fontLoadWithTimeout(
        Promise.all(
          ["Regular", "Bold"].map(async (style, i) => {
            const face = new FontFace(
              FONT_FAMILY,
              `url("${import.meta.env.BASE_URL}fonts/mindlab/NotoSansCJKkr-${style}.woff2")`,
              { weight: i ? "700" : "400", style: "normal" }
            );
            const loaded = await face.load();
            if (loaded.status !== "loaded") throw new Error("font unavailable");
            return loaded;
          })
        )
      );
      faces.forEach(face => document.fonts.add(face));
      await Promise.all(
        [400, 700].map(weight =>
          document.fonts.load(
            `${weight} 12px "${FONT_FAMILY}"`,
            "마인드랩 한글"
          )
        )
      );
      if (
        ![400, 700].every(weight =>
          document.fonts.check(
            `${weight} 12px "${FONT_FAMILY}"`,
            "마인드랩 한글"
          )
        )
      )
        throw new Error("font unavailable");
    })().catch(() => {
      fontPromise = undefined;
      throw new Error(
        "보고서 한글 글꼴을 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요."
      );
    });
  }
  return fontPromise;
}

export function canvasMeasure(context: CanvasRenderingContext2D): MeasureText {
  return (value, size, bold) => {
    context.font = `${bold ? 700 : 400} ${size}px "${FONT_FAMILY}"`;
    return context.measureText(value).width;
  };
}

function paint(context: CanvasRenderingContext2D, layout: ReportLayout) {
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, PAGE.width, PAGE.height);
  context.textBaseline = "alphabetic";
  for (const c of layout.commands) {
    context.fillStyle = c.color;
    if (c.kind === "text") {
      context.font = `${c.bold ? 700 : 400} ${c.size}px "${FONT_FAMILY}"`;
      context.fillText(c.text, c.x, c.y + c.size);
    } else if (c.kind === "rect") context.fillRect(c.x, c.y, c.width, c.height);
    else {
      context.strokeStyle = c.color;
      context.lineWidth = 0.6;
      context.beginPath();
      context.moveTo(c.x, c.y);
      context.lineTo(c.x + c.width, c.y + c.height);
      context.stroke();
    }
  }
}

function pngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(blob => {
      if (blob?.size) resolve(blob);
      else reject(new Error("이미지를 만들지 못했습니다. 다시 시도해 주세요."));
    }, "image/png")
  );
}

/** Guard at entry AND after asynchronous work; no external services or patient-data requests. */
export async function createReportDownload(
  submission: ResultSubmission,
  format: ReportFormat,
  hasFullAccess: boolean,
  isStillAllowed: () => boolean = () => hasFullAccess
): Promise<{ blob: Blob; filename: string }> {
  const assertAccess = () => {
    if (hasFullAccess !== true || !isStillAllowed())
      throw new Error("보고서 다운로드는 전체 조회 권한이 필요합니다.");
  };
  assertAccess();
  if (format !== "pdf" && format !== "png")
    throw new Error("지원하지 않는 파일 형식입니다.");
  const model = buildReportModel(submission, hasFullAccess);
  await loadReportFonts();
  assertAccess();
  const canvas = document.createElement("canvas");
  canvas.width = PNG_SIZE.width;
  canvas.height = PNG_SIZE.height;
  try {
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("이 브라우저에서는 보고서 이미지를 만들 수 없습니다.");
    const layout = layoutReport(model, canvasMeasure(context));
    context.scale(PNG_SIZE.width / PAGE.width, PNG_SIZE.height / PAGE.height);
    paint(context, layout);
    let blob = await pngBlob(canvas);
    if (format === "pdf") {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });
      doc.setProperties({
        title: "MindLab Enneagram Report",
        author: "MindLab",
        creator: "MindLab",
      });
      doc.addImage(
        new Uint8Array(await blob.arrayBuffer()),
        "PNG",
        0,
        0,
        210,
        297,
        undefined,
        "FAST"
      );
      blob = doc.output("blob");
    }
    assertAccess();
    return { blob, filename: `${model.filename}.${format}` };
  } finally {
    // Release the high-resolution pixel buffer even after a layout/encoding failure.
    canvas.width = 0;
    canvas.height = 0;
  }
}

export function saveReportBlob(
  blob: Blob,
  filename: string,
  hasFullAccess: boolean
) {
  if (hasFullAccess !== true)
    throw new Error("보고서 다운로드는 전체 조회 권한이 필요합니다.");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    // Safari/slow clients may still be consuming the object URL after click returns.
    window.setTimeout(() => URL.revokeObjectURL(url), URL_LIFETIME_MS);
  }
}

export async function downloadReport(
  submission: ResultSubmission,
  format: ReportFormat,
  hasFullAccess: boolean,
  isStillAllowed: () => boolean = () => hasFullAccess
) {
  const { blob, filename } = await createReportDownload(
    submission,
    format,
    hasFullAccess,
    isStillAllowed
  );
  saveReportBlob(blob, filename, hasFullAccess === true && isStillAllowed());
}
