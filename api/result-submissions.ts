import { get, list, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import type {
  ResultSubmission,
  ResultSubmissionPayload,
} from "../shared/resultSubmissions.ts";

const RESULT_SUBMISSIONS_PREFIX = "mind-compass-lab/result-submissions/";
const MAX_BODY_BYTES = 1024 * 1024;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

type BlobAccess = "private" | "public";

const blobAccess: BlobAccess =
  process.env.BLOB_ACCESS === "public" ? "public" : "private";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isNumericRecord(value: unknown): value is Record<number, number> {
  if (!isRecord(value)) return false;

  return Object.values(value).every(
    (item) => typeof item === "number" && Number.isFinite(item)
  );
}

function validatePayload(value: unknown): ResultSubmissionPayload {
  if (!isRecord(value)) {
    throw new Error("제출 데이터 형식이 올바르지 않습니다.");
  }

  const counselorName = normalizeText(value.counselorName);
  const respondentPhone = normalizeText(value.respondentPhone);

  if (counselorName.length < 2) {
    throw new Error("담당 상담사 이름을 2자 이상 입력해주세요.");
  }

  const phoneDigits = respondentPhone.replace(/\D/g, "");
  if (phoneDigits.length < 8 || phoneDigits.length > 15) {
    throw new Error("설문자 전화번호를 정확히 입력해주세요.");
  }

  if (!isRecord(value.participant) || !isRecord(value.result)) {
    throw new Error("결과 데이터가 누락되었습니다.");
  }

  if (!isNumericRecord(value.answers) || !isNumericRecord(value.result.typeScores)) {
    throw new Error("답변 또는 점수 데이터가 올바르지 않습니다.");
  }

  return {
    counselorName,
    respondentPhone,
    participant: {
      name: normalizeText(value.participant.name),
      birthDate: normalizeText(value.participant.birthDate),
      age:
        typeof value.participant.age === "number" && Number.isFinite(value.participant.age)
          ? value.participant.age
          : null,
    },
    result: value.result as unknown as ResultSubmissionPayload["result"],
    answers: value.answers,
    submittedFrom: normalizeText(value.submittedFrom) || undefined,
  };
}

async function parseJsonBody(request: Request) {
  const bodyText = await request.text();

  if (bodyText.length > MAX_BODY_BYTES) {
    throw new Error("제출 데이터가 너무 큽니다.");
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    throw new Error("JSON 요청 본문을 읽을 수 없습니다.");
  }
}

async function handlePost(request: Request) {
  const payload = validatePayload(await parseJsonBody(request));
  const createdAt = new Date().toISOString();
  const id = randomUUID();
  const safeCreatedAt = createdAt.replace(/[:.]/g, "-");
  const blobPathname = `${RESULT_SUBMISSIONS_PREFIX}${safeCreatedAt}-${id}.json`;

  const submission: ResultSubmission = {
    id,
    createdAt,
    blobPathname,
    ...payload,
  };

  const blob = await put(blobPathname, JSON.stringify(submission, null, 2), {
    access: blobAccess,
    contentType: "application/json; charset=utf-8",
    cacheControlMaxAge: 60,
  });

  return jsonResponse(
    {
      ok: true,
      submission: {
        id,
        createdAt,
        blobPathname,
        blobUrl: blob.url,
      },
    },
    { status: 201 }
  );
}

function requestedAccessKey(request: Request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  return bearer || searchParams.get("key")?.trim() || "";
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const lastFour = digits.slice(-4);

  return lastFour ? `***-****-${lastFour}` : "***-****";
}

function maybeRedact(submission: ResultSubmission, hasFullAccess: boolean) {
  if (hasFullAccess) return submission;

  return {
    ...submission,
    respondentPhone: maskPhone(submission.respondentPhone),
  };
}

async function readSubmission(pathname: string): Promise<ResultSubmission | null> {
  const result = await get(pathname, { access: blobAccess });

  if (!result || result.statusCode !== 200) {
    return null;
  }

  const text = await new Response(result.stream).text();
  const parsed = JSON.parse(text) as ResultSubmission;

  return parsed;
}

async function handleGet(request: Request) {
  const { searchParams } = new URL(request.url);
  const accessKey = process.env.RESULTS_ACCESS_KEY?.trim() ?? "";
  const accessKeyConfigured = accessKey.length > 0;
  const hasFullAccess = accessKeyConfigured
    ? requestedAccessKey(request) === accessKey
    : false;

  if (accessKeyConfigured && !hasFullAccess) {
    return jsonResponse(
      {
        error: "결과 조회 접근키가 필요합니다.",
        requiresAccessKey: true,
      },
      { status: 401 }
    );
  }

  const requestedLimit = Number(searchParams.get("limit"));
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const allBlobs = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const page = await list({
      prefix: RESULT_SUBMISSIONS_PREFIX,
      limit: 1000,
      cursor,
    });

    allBlobs.push(...page.blobs);
    hasMore = page.hasMore;
    cursor = page.cursor;
  }

  const latestBlobs = allBlobs
    .sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )
    .slice(0, limit);

  const submissions = (
    await Promise.all(
      latestBlobs.map(async (blob) => {
        try {
          const submission = await readSubmission(blob.pathname);
          if (!submission) return null;

          return maybeRedact(
            {
              ...submission,
              blobPathname: blob.pathname,
              blobUrl: blob.url,
            },
            hasFullAccess
          );
        } catch {
          return null;
        }
      })
    )
  ).filter((item): item is ResultSubmission => Boolean(item));

  return jsonResponse({
    submissions,
    total: allBlobs.length,
    hasFullAccess,
    accessKeyConfigured,
  });
}

async function withApiErrors(callback: () => Promise<Response>) {
  try {
    return await callback();
  } catch (error) {
    console.error(error);

    const rawMessage =
      error instanceof Error
        ? error.message
        : "결과 제출 처리 중 문제가 발생했습니다.";
    const message = rawMessage.includes("No blob credentials found")
      ? "Vercel Blob 연결 환경변수(BLOB_READ_WRITE_TOKEN)가 설정되지 않았습니다. Vercel Storage와 프로젝트 연결 상태를 확인해주세요."
      : rawMessage;

    return jsonResponse({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return withApiErrors(() => handlePost(request));
}

export async function GET(request: Request) {
  return withApiErrors(() => handleGet(request));
}

export default {
  fetch(request: Request) {
    if (request.method === "POST") {
      return POST(request);
    }

    if (request.method === "GET") {
      return GET(request);
    }

    return jsonResponse(
      { error: "지원하지 않는 요청 방식입니다." },
      { status: 405, headers: { Allow: "GET, POST" } }
    );
  },
};
