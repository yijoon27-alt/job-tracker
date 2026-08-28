# Job Tracker 작업 요약

## 현재 상태

- 공개 사이트: `https://yijoon27-alt.github.io/job-tracker/`
- 공개 GitHub Pages이지만 지원 기록은 공개되지 않는다.
- Google 계정으로 로그인하며, 데이터는 Supabase에 사용자 ID별로 저장된다.
- 같은 Google 계정으로 로그인하면 다른 컴퓨터와 휴대폰에서도 동일한 기록이 표시된다.
- 다른 사용자는 본인 데이터만 조회·작성할 수 있고 다른 사용자의 기록은 볼 수 없다.
- 기존 브라우저 `localStorage` 기록의 본인 계정 이전을 완료했다.
- 현황판은 마감, 기업·직무, 지원 자료, 전체 전형 단계를 묶은 압축형 표를 사용한다.
- 기업별 서류 작성 여부를 바로 체크할 수 있고, 전체 공고·작성 완료·결과 대기·서류 합격률·면접 진행 요약이 저장 즉시 갱신된다.

## 구현 구조

- 프런트엔드: 정적 `HTML / CSS / JavaScript`, GitHub Pages 배포
- 로그인: Supabase Auth + Google OAuth
- 데이터베이스: Supabase Postgres
- 접근 제어: Postgres Row Level Security(RLS)에서 `auth.uid() = user_id` 강제
- 기존 데이터 이전: 비공개 허용 목록에 등록된 Google 계정만 사용할 수 있는 1회성 DB 함수

## 주요 파일

- `index.html`: Google 로그인 화면과 대시보드 마크업
- `style.css`: 로그인·대시보드 스타일
- `app.js`: Google 로그인, Supabase CRUD, 검색·수정·삭제, 기존 데이터 이전
- `config.js`: Supabase Project URL과 브라우저용 Publishable key
- `supabase-schema.sql`: 테이블, RLS, 권한, 이전용 보안 함수
- `README.md`: Supabase·Google OAuth 설정 및 배포 안내

## 보안 원칙

- `config.js`에는 `sb_publishable_...` 키만 사용한다.
- Supabase `sb_secret_...`, `service_role`, Database password는 코드·GitHub·채팅에 절대 넣지 않는다.
- Google OAuth Client Secret은 Supabase Dashboard에만 보관한다.
- 사용자 입력은 `innerHTML`로 렌더링하지 않으며 외부 링크는 `http/https`만 허용한다.
- 비로그인 요청과 다른 사용자의 행 접근은 DB에서 차단한다.
- 기존 데이터 이전은 서버에서 Google 제공자, 허용 이메일, 1회 사용 여부를 검증한다.

## 운영 참고

- Google OAuth가 테스트 상태라면 등록된 테스트 사용자만 로그인할 수 있다.
- 여러 사람에게 공개하려면 Google Auth Platform에서 테스트 사용자를 추가하거나 앱 게시 상태를 변경한다.
- 다른 사람이 자기 Google 계정으로 로그인하면 빈 개인 대시보드에서 시작한다.
- 데이터 변경 후 GitHub Pages에 반영하려면 변경 파일을 `main` 브랜치에 업로드하고 배포 완료 후 강력 새로고침한다.
- 기존 로컬 데이터는 서버 이전 성공 후 사용자별 로컬 백업 키로 이동하며, 새 데이터의 원본은 Supabase다.
- UI 배포 전에 Supabase SQL Editor에서 최신 `supabase-schema.sql`을 다시 실행해 DB 필드와 열 권한을 먼저 반영한다.

## 확인한 동작

- Google Provider 활성화 확인
- 비로그인 데이터 요청 `401` 차단 확인
- 허용된 Google 계정의 기존 데이터 이전 성공 확인
- 허용되지 않은 계정의 이전 함수 호출 거부 확인
- 사용자별 RLS 데이터 격리와 이전용 필드 직접 쓰기 차단 확인
