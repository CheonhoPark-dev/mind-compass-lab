# 홈페이지 개선 및 유형별 응답 내보내기

- 반응형 홈페이지와 키보드 접근 가능한 기존 결제 모달 UI 개선. 검사 문항, 채점 및 기존 제출 흐름은 유지.
- 전체 조회 권한이 있는 결과에서만 유형별 응답 보기 및 JSON/TXT 다운로드 제공.
- 현재 표준 81문항을 9유형으로 정리하고 원래 번호/문구/저장 점수를 사용. 미응답은 0점으로 채우지 않으며 알 수 없는 ID는 별도 보존.
- TXT는 UTF-8 BOM 및 CRLF를 사용하며 JSON에는 원본 데이터와 answersByType/unknownAnswers를 함께 제공.

## 릴리스 확인

원본 main의 롤백 기준: `186ea004b8d71cb060259f2962b61268c291d36a`.
기존 GitHub 연동 Vercel 프로젝트: `cheonho-parks-projects/mind-compass-lab`.
새 프로젝트 생성이나 환경변수 변경 없이 main push의 기존 배포 연동 사용.

검증 명령: `npx --no-install vitest run` (18 tests), `npm run check`, `npm run build`, `git diff --cached --check` 및 staged secret scan.
빌드는 통과하며 큰 JS 청크 경고는 남아 있음.
이전 브라우저 검증기의 'tracked 변경 파일 2개' 가정은 승인된 ResultsDashboard 변경으로 더 이상 유효하지 않음.

운영 확인은 공개 랜딩/정적 자산/결과 라우트 셸에 한정. 실제 상담 결과 API 조회, 개인 데이터 내보내기, 폼 제출 및 결제를 실행하지 않음.
배포 완료는 해당 커밋의 GitHub Vercel 상태 및 Production deployment 상태와 공개 URL을 확인하여 판단.
생성 이미지, 런타임 보고서, 임시 샘플 TXT/JSON 및 절대경로 일회성 스크립트는 커밋하지 않음.
