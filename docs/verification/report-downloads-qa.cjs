// Local synthetic QA only. No application route, credentials, or real API data.
// QA_PLAYWRIGHT_MODULE=/path/to/playwright QA_BASE=http://127.0.0.1:4194 node docs/verification/report-downloads-qa.cjs
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const base = process.env.QA_BASE || "http://127.0.0.1:4194";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "QA must use localhost"
);
const out = path.resolve(".cache/report-downloads-qa");
const templates = JSON.parse(
  fs.readFileSync("client/src/lib/report/typeExplanations.json", "utf8")
);
const synthetic = type => ({
  id: `PRIVATE-ID-${type}`,
  createdAt: "2026-01-01T23:30:00Z",
  blobPathname: "PRIVATE-PATH",
  counselorName:
    type === 6
      ? "나".repeat(80)
      : type === 9
        ? "긴상담사이름".repeat(12)
        : "검증상담사",
  respondentPhone: "PRIVATE-PHONE",
  participant: {
    name:
      type === 6
        ? "가".repeat(80)
        : type === 9
          ? "긴참여자이름".repeat(12)
          : "검증참여자",
    birthDate: "PRIVATE-BIRTH",
    age: null,
  },
  answers: { 3: 99999 },
  result: {
    primaryType: type,
    primaryTypeName: "검증유형",
    primaryTypeTitle: "",
    wingType: 0,
    wingCode: `${type}w${type === 1 ? 9 : type - 1}`,
    wingName: "",
    wingTitle: "",
    report: null,
    typeScores: Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => [
        i + 1,
        type === 6 ? 0 : i + 1 === type ? 45 : 20 + i,
      ])
    ),
    rankedTypes: [],
    centers: [],
  },
});
const normalize = text => text.replace(/\s/g, "");
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.QA_CHROME || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-background-networking"],
  });
  const summary = [];
  try {
    async function setup(rows, full = true, width = 1440, fontMode = {}) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        serviceWorkers: "block",
        locale: "ko-KR",
        timezoneId: "Asia/Seoul",
        acceptDownloads: true,
      });
      const requests = [],
        pageErrors = [];
      await context.route("**/*", async route => {
        const request = route.request(),
          url = new URL(request.url());
        requests.push({ url: url.href, method: request.method() });
        if (url.origin !== base) return route.abort();
        if (url.pathname.startsWith("/api/")) {
          assert.equal(request.method(), "GET");
          assert.ok(
            ["/api/result-submissions", "/api/drawing-submissions"].includes(
              url.pathname
            )
          );
          return route.fulfill({
            json: {
              submissions: url.pathname.includes("drawing") ? [] : rows,
              total: rows.length,
              hasFullAccess: full,
              accessKeyConfigured: true,
            },
          });
        }
        if (url.pathname.endsWith(".woff2")) {
          if (fontMode.fail) return route.abort();
          if (fontMode.gate) await fontMode.gate;
        }
        return route.continue();
      });
      await context.addInitScript(() => {
        window.__reportDraws = [];
        const original = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (
          text,
          x,
          y,
          ...args
        ) {
          if (this.font.includes("MindLabReport"))
            window.__reportDraws.push({
              text,
              x,
              y,
              font: this.font,
              width: this.measureText(text).width,
            });
          return original.call(this, text, x, y, ...args);
        };
      });
      const page = await context.newPage();
      page.on("pageerror", e => pageErrors.push(e.message));
      await page.goto(base + "/result");
      await page.locator(".rd-record").first().waitFor();
      assert.equal(
        await page.locator(".drawing-results .rd-report-downloads").count(),
        0
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth
        ),
        false
      );
      assert.ok(
        !requests.some(r =>
          /\/fonts\/mindlab\/|\/download-[^/]+\.js|\/jspdf[^/]*\.js/.test(r.url)
        ),
        "export assets must remain lazy"
      );
      return { context, page, requests, pageErrors };
    }
    async function download(page, card, format, filename, release) {
      await page.evaluate(() => {
        window.__reportDraws = [];
      });
      const event = page.waitForEvent("download");
      await card
        .getByRole("button", {
          name: format.toUpperCase() + " 다운로드",
          exact: true,
        })
        .click();
      if (release) await release();
      const artifact = await event;
      assert.equal(
        artifact.suggestedFilename(),
        "mindlab-result-2026-01-02." + format
      );
      await artifact.saveAs(path.join(out, filename));
      assert.equal(await artifact.failure(), null);
      const bytes = fs.readFileSync(path.join(out, filename));
      if (format === "png") {
        assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
        assert.equal(bytes.readUInt32BE(16), 2480);
        assert.equal(bytes.readUInt32BE(20), 3508);
      } else {
        assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
        const info = execFileSync("pdfinfo", [path.join(out, filename)], {
          encoding: "utf8",
        });
        assert.match(info, /Pages:\s+1\b/);
        assert.match(info, /Page size:.*\(A4\)/);
      }
      const draws = await page.evaluate(() => window.__reportDraws);
      assert.ok(draws.length > 100);
      for (const c of draws) {
        assert.ok(
          c.x >= 34 && c.x + c.width <= 561.4,
          "horizontal text bounds"
        );
        assert.ok(c.y > 34 && c.y <= 808, "vertical text bounds");
        assert.ok(
          Number(c.font.match(/([\d.]+)px/)[1]) >= 10.5,
          "minimum readable type size"
        );
      }
      const text = draws.map(c => c.text).join("");
      assert.doesNotMatch(text, /PRIVATE-|99999|가상 데이터|인쇄 검토|샘플/);
      assert.match(text, /제출일/);
      assert.match(text, /임상 진단이나 능력 평가가 아닙니다/);
      await card
        .getByRole("button", { name: "PDF 다운로드", exact: true })
        .waitFor({ state: "visible" });
      return text;
    }
    let releaseFonts;
    const fontMode = {
      gate: new Promise(resolve => {
        releaseFonts = resolve;
      }),
    };
    const rows = Array.from({ length: 9 }, (_, i) => synthetic(i + 1));
    const { context, page, requests, pageErrors } = await setup(
      rows,
      true,
      1440,
      fontMode
    );
    const before = requests.length;
    for (let type = 1; type <= 9; type++) {
      const card = page.locator(".rd-record").nth(type - 1);
      const text = await download(
        page,
        card,
        "png",
        `type-${type}.png`,
        type === 1
          ? async () => {
              assert.ok(
                await card
                  .getByRole("button", { name: "PDF 다운로드", exact: true })
                  .isDisabled()
              );
              assert.ok(
                await card
                  .getByRole("button", { name: "PNG 다운로드", exact: true })
                  .isDisabled()
              );
              assert.ok(
                await page
                  .locator(".rd-record")
                  .nth(1)
                  .getByRole("button", { name: "PNG 다운로드", exact: true })
                  .isEnabled()
              );
              releaseFonts();
            }
          : undefined
      );
      for (const section of templates[type - 1].sections)
        assert.ok(
          normalize(text).includes(normalize(section.text)),
          "complete section"
        );
      assert.ok(normalize(text).includes(rows[type - 1].participant.name));
      assert.ok(normalize(text).includes(rows[type - 1].counselorName));
      await download(page, card, "pdf", `type-${type}.pdf`);
      summary.push({
        type,
        png: "2480x3508",
        pdf: "1 A4 page",
        fullText: true,
      });
    }
    assert.ok(
      requests
        .slice(before)
        .every(r => r.method === "GET" && new URL(r.url).origin === base),
      "exports must stay local"
    );
    assert.deepEqual(pageErrors, []);
    await context.close();

    for (const width of [390, 1440]) {
      const restricted = await setup([synthetic(6)], false, width);
      for (const format of ["PDF", "PNG"])
        assert.ok(
          await restricted.page
            .getByRole("button", { name: format + " 다운로드", exact: true })
            .isDisabled()
        );
      await restricted.page.screenshot({
        path: path.join(out, `restricted-${width}.png`),
        fullPage: true,
      });
      assert.deepEqual(restricted.pageErrors, []);
      await restricted.context.close();
    }
    const missing = synthetic(6);
    missing.result.primaryType = 0;
    missing.result.wingCode = "6w4";
    missing.result.typeScores = { 1: 0, 3: 24 };
    const incomplete = await setup([missing], true, 390);
    const text = await download(
      incomplete.page,
      incomplete.page.locator(".rd-record"),
      "png",
      "missing.png"
    );
    assert.match(text, /유형 해설 안내/);
    assert.match(text, /미기록/);
    assert.equal(
      await incomplete.page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth
      ),
      false
    );
    await incomplete.page.screenshot({
      path: path.join(out, "mobile.png"),
      fullPage: true,
    });
    await incomplete.context.close();

    const failureMode = { fail: true };
    const failure = await setup([synthetic(6)], true, 390, failureMode);
    let unexpectedDownloads = 0;
    failure.page.on("download", () => {
      unexpectedDownloads++;
    });
    await failure.page
      .getByRole("button", { name: "PNG 다운로드", exact: true })
      .click();
    await failure.page
      .getByText(
        "보고서 한글 글꼴을 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.",
        { exact: true }
      )
      .waitFor();
    assert.equal(unexpectedDownloads, 0);
    assert.ok(
      await failure.page
        .getByRole("button", { name: "PNG 다운로드", exact: true })
        .isEnabled()
    );
    failureMode.fail = false;
    await download(
      failure.page,
      failure.page.locator(".rd-record"),
      "png",
      "font-retry.png"
    );
    assert.equal(unexpectedDownloads, 1);
    assert.deepEqual(failure.pageErrors, []);
    await failure.context.close();

    let releaseRevokedFonts;
    const revoked = await setup([synthetic(1)], true, 390, {
      gate: new Promise(resolve => {
        releaseRevokedFonts = resolve;
      }),
    });
    let revokedDownloads = 0;
    revoked.page.on("download", () => {
      revokedDownloads++;
    });
    await revoked.page
      .getByRole("button", { name: "PNG 다운로드", exact: true })
      .click();
    await revoked.page.route("**/api/result-submissions?limit=300", route =>
      route.fulfill({
        json: {
          submissions: [synthetic(1)],
          total: 1,
          hasFullAccess: false,
          accessKeyConfigured: true,
        },
      })
    );
    await revoked.page
      .getByRole("button", { name: "새로고침", exact: true })
      .click();
    await revoked.page
      .getByText("접근 제한 · 개인정보와 문항 응답 보호", { exact: true })
      .waitFor();
    releaseRevokedFonts();
    await revoked.page
      .getByText("보고서 다운로드는 전체 조회 권한이 필요합니다.", {
        exact: true,
      })
      .waitFor();
    assert.equal(revokedDownloads, 0);
    assert.ok(
      await revoked.page
        .getByRole("button", { name: "PNG 다운로드", exact: true })
        .isDisabled()
    );
    assert.deepEqual(revoked.pageErrors, []);
    await revoked.context.close();
    fs.writeFileSync(
      path.join(out, "summary.json"),
      JSON.stringify(
        {
          cases: summary,
          restrictedWidths: [390, 1440],
          fontFailureRetry: true,
          busyPerCard: true,
          revokedDuringGeneration: true,
          missingPrimaryGuidance: true,
          lazyAssets: true,
          externalExportRequests: 0,
        },
        null,
        2
      )
    );
    console.log(
      JSON.stringify({
        passed: true,
        artifacts: out,
        types: summary.length,
        pdfDownloads: 9,
        pngDownloads: 11,
        gates: true,
        fontRetry: true,
        mobile: true,
      })
    );
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
