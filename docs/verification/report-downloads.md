# Result PDF / PNG downloads

The results dashboard now offers local PDF and PNG downloads under the existing
`hasFullAccess` gate. Drawing results and authentication policy are unchanged.
No commits, pushes, or deployment are part of this change.

## Implementation

- `client/src/components/ReportDownloadButtons.tsx`: per-card busy state, disabled
  restricted actions, error toasts, cancellation on unmount or loss of access.
- `client/src/lib/report/model.ts`: allowlisted data, stored primary/adjacent wing
  validation, finite scores including zero, deterministic low ties, Seoul submission
  date. No answer recalculation, phone, birth date, record ID, credentials, or
  freeform saved report content enters the report model or filename.
- `layout.ts`: measured A4 layout, nine vertical raw-score bars with a common
  dynamic axis, five complete type sections, four separators, one exact highlighted
  phrase per section, two-sentence low note, common nonclinical notice. Default
  body 11.5pt; measured 11pt/10.5pt variants support long metadata without clipping.
  Names up to 80 Unicode code points are preserved. Oversized names or content
  that cannot fit even at 10.5pt produce an error before downloading.
- `download.ts`: lazy local fonts and canvas renderer; PNG 2480×3508; lazy pinned
  jsPDF 4.2.1 embeds that image on one A4 PDF page. A 30-second font timeout allows
  retry. Access is checked before and after async generation. Object URLs are
  revoked after 60 seconds. No DOM screenshot, telemetry, or external upload.
- `typeExplanations.json`: the nine type templates from the user-provided
  `mindlab-type-explanations-v1.json`; source editorial metadata is not exported.
  Layout follows the approved `mindlab-a4-v9.html` reference. Source files outside
  the repository were only read.
- `client/public/fonts/mindlab/`: Korean Noto font subsets and license, about 2.4MB
  combined, requested only after clicking an export button.

The current question set is nine questions per type with 1–5 responses. Reports
use stored raw scores, not a claimed maximum of 50 or normalized percentages.
Missing/nonfinite values read `미기록`. A saved primary inconsistent with the maximum
is preserved with a note; an invalid primary gets guidance instead of an invented
type. Lowest ties choose the smallest recorded type number and explain that choice.

## Verification

```sh
corepack pnpm check
corepack pnpm exec vitest run --root .
corepack pnpm build
corepack pnpm exec vite preview --host 127.0.0.1 --port 4194 --strictPort
```

With Playwright and a Chromium binary already installed, in another terminal:

```sh
QA_PLAYWRIGHT_MODULE=/tmp/mindlab-browser-qa/node_modules/playwright \
QA_CHROME=/usr/bin/google-chrome \
QA_BASE=http://127.0.0.1:4194 \
node docs/verification/report-downloads-qa.cjs
```

The helper refuses non-localhost targets, intercepts all API calls with synthetic
records, blocks external origins, and creates no public test route. It exercises
real production buttons, saves nine PDFs and eleven PNGs, checks PDF signatures
and one A4 page with `pdfinfo`, verifies PNG signatures/dimensions and complete
canvas text/bounds at ≥10.5pt, and covers all nine templates, 80-character names
plus all-zero ties, missing primary/scores, mobile/restricted controls, card-local
busy state, access revoked during generation, lazy loading, and font failure/retry. Artifacts and summary are in
`.cache/report-downloads-qa/` (gitignored).

Unit tests additionally cover invalid primary/wing combinations, score selection,
negative/fractional/nonfinite scores, extreme finite axis arithmetic, missing dates,
allowlisted privacy fields, function-level permission guards and delayed URL
revocation. Full Vitest includes existing drawing API/shared/client tests.

PDF pages are raster images, so text is not selectable. Chromium downloads were
verified locally; parent deployment and Safari/iOS download UX remain separate.
The existing public-results privacy concern is outside this feature's scope.
