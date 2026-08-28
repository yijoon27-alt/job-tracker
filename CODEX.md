# Job Tracker 작업 인수인계

## 프로젝트 목적과 현재 상태

- 공개 사이트: `https://yijoon27-alt.github.io/job-tracker/`
- 정적 `HTML / CSS / JavaScript` 앱이며 GitHub Pages로 배포한다.
- 사이트 코드는 공개되지만 지원 기록은 공개되지 않는다.
- Google OAuth로 로그인하고 지원 기록은 Supabase Postgres에 저장한다.
- 모든 지원 기록은 `user_id`로 소유자를 구분하며 RLS가 `auth.uid() = user_id`를 강제한다.
- 같은 Google 계정으로 로그인하면 컴퓨터와 휴대폰에서 동일한 기록을 확인할 수 있다.
- 기존 브라우저 `localStorage` 기록의 본인 계정 이전은 완료된 상태다.
- 2026-08-28 요약 카드와 서류 작성 체크를 추가한 1차 UI/UX 개편은 GitHub에 업로드했다.
- 현재 로컬 작업본에는 현황판 전체 폭 사용, 오른쪽 등록·수정 패널, 마감 강조, 탈락 취소선과 압축형 전형 흐름을 추가했다. 이 2차 UI 파일은 다시 GitHub에 업로드해야 한다.
- 현재 배포판은 Supabase의 `jobs.document_prepared` 필드를 전제로 한다. GitHub 배포와 별개로 최신 `supabase-schema.sql`이 Supabase SQL Editor에 적용되어 있어야 한다.

## 현재 현황판 UI/UX

- 기존의 긴 15개 열을 다음 6개 묶음으로 압축했다.
  - 마감: D-Day와 실제 마감일
  - 기업 / 지원 직무: 기업명과 직무
  - 서류 작성: 즉시 저장 체크
  - 지원 자료: 채용 링크, JD, 우대사항, 자기소개서
  - 현재 전형: 핵심 상태 한 줄과 서류·1차·2차·최종 단계 흐름
  - 관리: 수정과 삭제
- 서류·1차·2차·최종 단계 정보는 삭제하지 않고 작은 단계 흐름으로 유지하되 현재 상태만 강하게 표시한다.
- 서류·1차·2차·최종 중 하나라도 탈락이면 기업명과 직무에 빨간 취소선을 표시하고 행 배경을 낮춘다.
- 앞 단계에서 탈락하면 뒤 단계의 반복적인 `미대상/최종탈락`은 현황판에서 `—`로 정리한다. 원본 값은 DB와 수정 패널에 유지한다.
- 행 왼쪽 선은 서류 작성 여부가 아니라 마감 상태를 나타낸다. D-3 이하는 빨강, D-7 이하는 주황, 여유 공고는 연회색이다. 이미 마감된 행은 회색으로 낮추되 `마감` 배지는 빨강으로 유지한다.
- 기본 정렬은 진행 중인 공고를 종료된 지원보다 먼저, 마감 전 공고를 마감 공고보다 먼저 보여준다. 예정 공고는 가까운 마감일부터, 마감 공고는 최근 마감일부터 정렬한다.
- `서류 작성` 열의 `미작성 / 작성 완료` 체크박스를 누르면 별도의 수정 화면 없이 Supabase에 즉시 저장된다.
- 등록·수정 폼에서도 `서류 작성 완료`를 함께 지정할 수 있다.
- 현황판은 화면 전체 폭을 사용하고 `+ 공고 등록` 또는 `수정`을 누르면 오른쪽 슬라이드 패널에서 입력 폼이 열린다.
- 검색, 최종 상태 필터와 함께 `서류 전체 / 미작성 / 작성 완료` 필터를 제공한다.
- 데스크톱에서는 압축형 표, 폭 720px 이하에서는 기업별 카드 형태로 표시한다.
- CSS와 JavaScript에는 `20260828-drawer-workflow` 캐시 버전이 적용되어 있다.

## 요약 통계 계산 기준

요약 카드는 검색이나 필터 결과가 아니라 로그인한 사용자의 전체 `jobs` 배열을 기준으로 계산하며, 저장·수정·삭제·서류 작성 체크가 성공할 때마다 다시 렌더링한다.

- `전체 공고`: 저장된 전체 지원 공고 수
- `서류 작성`: `document_prepared = true`인 수와 전체 공고 수, 작성 완료 비율
- `서류 결과 대기`: 서류 작성 완료 건 중 `doc_status = '대기'`인 수
- `서류 합격률`: 서류 작성 완료 건 중 `합격 / (합격 + 탈락) × 100`; 결과 대기 건은 분모에서 제외
- `면접 진행`: 서류 작성 완료 건 중 1차 또는 2차 면접 결과가 `대기`인 단계 수; 1차와 2차 수를 따로 표시

## 데이터 구조

`public.jobs`의 주요 필드는 다음과 같다.

- 기본 정보: `company`, `role`, `deadline`, `link`
- 지원 자료: `jd`, `preferred`, `cover_letter`
- 작성 여부: `document_prepared boolean not null default false`
- 전형 상태: `doc_status`, `interview1_date`, `interview1_result`, `interview2_date`, `interview2_result`, `final_status`
- 소유권과 기록: `user_id`, `legacy_id`, `created_at`, `updated_at`

허용 상태값은 다음과 같다.

- 서류: `대기`, `합격`, `탈락`
- 1·2차 면접: `미대상`, `대기`, `합격`, `탈락`
- 최종: `진행중`, `최종합격`, `최종탈락`

`supabase-schema.sql`은 기존 테이블에 `document_prepared`가 없을 때만 필드를 추가한다. 필드 추가 시 기존 기록 중 자기소개서가 있거나 전형 단계가 이미 진행된 기록은 작성 완료로 한 번 보정한다. 스크립트를 다시 실행해도 기존 지원 기록을 삭제하지 않는다.

## 주요 파일

- `index.html`: 로그인, 오른쪽 등록·수정 패널, 요약 카드, 필터와 압축형 현황판 마크업
- `style.css`: 전체 레이아웃, 오른쪽 패널, 마감·탈락 표시, 단계 흐름과 모바일 카드 스타일
- `app.js`: Google 로그인, Supabase CRUD, 패널 제어, 서류 작성 즉시 저장, 전형 요약, 검색·필터, 통계, 백업과 기존 데이터 이전
- `config.js`: Supabase Project URL과 브라우저용 Publishable key
- `supabase-schema.sql`: 테이블과 필드 마이그레이션, 열 권한, RLS, 트리거와 기존 데이터 이전 함수
- `README.md`: Supabase, Google OAuth와 GitHub Pages 설정 안내

DB 필드를 추가하거나 이름을 바꿀 때는 `supabase-schema.sql`만 수정하면 안 된다. `app.js`의 `DB_COLUMNS`, DB↔화면 변환, 폼 저장, 빠른 업데이트, JSON 백업, 기존 데이터 정규화와 SQL의 `grant insert/update` 목록을 함께 맞춰야 한다.

## 배포와 업데이트 순서

1. Supabase SQL Editor에서 최신 `supabase-schema.sql` 전체를 실행한다.
2. `index.html`, `style.css`, `app.js`, `supabase-schema.sql`과 갱신한 문서를 GitHub `main` 브랜치에 업로드한다.
3. GitHub Pages 배포 완료를 기다린다.
4. 공개 사이트에서 강력 새로고침한 뒤 Google 로그인, 목록 로딩, 서류 작성 체크와 통계 갱신을 확인한다.

DB보다 웹 코드를 먼저 배포하면 `document_prepared` 열을 조회하지 못해 전체 목록 로딩이 실패할 수 있다. 스키마를 먼저 적용한다.

## 보안 원칙

- `config.js`에는 `sb_publishable_...` 형식의 공개 웹 클라이언트용 키만 사용한다.
- Supabase `sb_secret_...`, `service_role`, Database password는 코드, GitHub, 채팅에 절대 넣지 않는다.
- Google OAuth Client Secret은 Supabase Dashboard에만 보관한다.
- 사용자 입력은 `innerHTML`로 렌더링하지 않는다.
- 채용 링크는 `http`와 `https`만 허용한다.
- 비로그인 요청과 다른 사용자의 행 접근은 DB의 권한과 RLS에서 차단한다.
- 일반 사용자는 `user_id`, `legacy_id`, 생성 시각 같은 소유권·이전용 필드를 직접 쓸 수 없다.
- Supabase 브라우저 라이브러리는 정확한 버전으로 고정하고 SRI 무결성 검사를 유지한다.

## 기존 데이터 이전과 백업

- 기존 데이터 이전은 비공개 허용 목록에 등록된 Google 계정만 한 번 사용할 수 있다.
- DB 함수가 Google 제공자, 이메일, 허용 여부와 1회 사용 여부를 서버에서 재검증한다.
- DB 트랜잭션이 성공한 뒤에만 기존 `excelJobs`를 사용자별 로컬 백업 키로 이동한다.
- 신규 데이터의 원본은 Supabase이며 `localStorage`를 원본 저장소로 사용하지 않는다.
- `내 데이터 백업`은 모든 지원 정보와 `documentPrepared` 값을 JSON으로 내려받는다.

## 운영 참고

- Google OAuth 앱이 테스트 상태면 등록된 테스트 사용자만 로그인할 수 있다.
- 다른 사용자가 자기 Google 계정으로 로그인하면 빈 개인 대시보드에서 시작한다.
- 여러 사용자에게 공개하려면 Google Auth Platform에서 테스트 사용자를 추가하거나 앱 게시 상태를 변경한다.
- UI가 이전 버전으로 보이면 GitHub Pages 배포 완료 여부를 확인하고 강력 새로고침한다.
- Supabase SQL 적용 여부는 GitHub 업로드만으로 확인할 수 없으므로 Supabase Dashboard에서 별도로 확인한다.

## 확인된 항목

- Google Provider 로그인 동작
- 비로그인 데이터 요청 `401` 차단
- 허용된 계정의 기존 데이터 이전 성공
- 허용되지 않은 계정의 이전 함수 호출 거부
- 사용자별 RLS 데이터 격리와 이전용 필드 직접 쓰기 차단
- 2026-08-28 변경 코드의 JavaScript 구문 검사
- HTML DOM ID와 JavaScript 참조 연결 검사
- CSS 규칙 블록 구조 검사
- `document_prepared` 필드, 열 권한과 이전 함수의 SQL 정적 구조 검사

실제 운영 Supabase에서 최신 SQL이 실행되었는지와 GitHub Pages에서 새 UI가 표시되는지는 배포 후 브라우저에서 최종 확인한다.
