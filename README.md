# Job Tracker

공개 GitHub Pages에서 Google 계정으로 로그인하는 사용자별 비공개 공채 대시보드입니다. 사이트 코드는 공개되지만, 지원 기록은 Supabase 사용자 ID별로 분리되고 데이터베이스의 RLS 정책이 다른 사용자의 접근을 차단합니다.

## 1. Supabase 데이터베이스 설정

1. [Supabase](https://supabase.com/dashboard)에서 프로젝트를 만듭니다.
2. **SQL Editor**에서 [`supabase-schema.sql`](./supabase-schema.sql) 전체를 한 번 실행합니다.
3. 같은 SQL Editor에서 아래 문장만 따로 실행합니다. 이메일은 기존 기록을 가져갈 본인의 Google 이메일로 바꿉니다.

이미 운영 중인 프로젝트에 새 버전을 반영할 때도 `supabase-schema.sql` 전체를 다시 실행합니다. 스크립트는 기존 지원 기록을 삭제하지 않고 `서류 작성 여부` 같은 새 필드와 권한만 안전하게 추가합니다.

```sql
insert into private.legacy_migration_owners (email)
values (lower('YOUR_GOOGLE_EMAIL@gmail.com'))
on conflict (email) do nothing;
```

실제 이메일을 `supabase-schema.sql`이나 GitHub 파일에 적지 마세요. 위 설정은 공개 API에서 읽을 수 없는 `private` 스키마에 저장되며, 기존 기록 이전에만 사용됩니다.

## 2. Google 로그인 연결

1. [Google Auth Platform](https://console.cloud.google.com/auth/overview)에서 프로젝트와 OAuth 동의 화면을 설정합니다.
2. 데이터 접근 범위는 `openid`, 이메일, 기본 프로필만 사용합니다. Gmail·Drive 등의 추가 권한은 요청하지 않습니다.
3. **Web application** 유형의 OAuth Client를 만듭니다.
4. Authorized JavaScript origins에는 `https://yijoon27-alt.github.io`를 넣습니다. 경로 `/job-tracker/`는 origin에 넣지 않습니다.
5. Authorized redirect URIs에는 Supabase Dashboard의 **Authentication > Sign In / Providers > Google**에 표시되는 Callback URL을 정확히 넣습니다. 보통 다음 형태입니다.

```text
https://PROJECT_REF.supabase.co/auth/v1/callback
```

6. Google에서 발급된 Client ID와 Client Secret은 Supabase의 Google Provider 설정에만 입력하고 Google Provider를 활성화합니다.
7. Supabase의 **Authentication > URL Configuration**에서 Site URL과 Redirect URLs에 `https://yijoon27-alt.github.io/job-tracker/`를 등록합니다.
8. 이메일·비밀번호 로그인을 쓰지 않을 예정이면 Supabase에서 Email 로그인을 비활성화하고 Google Provider만 운영합니다.

**Google Client Secret은 GitHub, `config.js`, HTML, JavaScript, 채팅 또는 브라우저에 절대로 넣지 마세요.**

## 3. 웹 앱 연결

1. Supabase의 **Connect** 또는 **Settings > API Keys**에서 다음 두 값을 확인합니다.
   - Project URL: `https://...supabase.co`
   - Publishable key: `sb_publishable_...`
2. [`config.js`](./config.js)의 자리표시자를 위 두 값으로 교체합니다.
3. 변경 파일을 GitHub에 올리고 GitHub Pages 배포가 끝나면 Google로 로그인합니다.

`config.js`는 공개되는 파일입니다. Publishable key는 공개 웹 클라이언트용이지만 반드시 RLS와 함께 사용해야 합니다. 앱은 `sb_publishable_...` 형식이 아닌 키, 특히 `sb_secret_...` Secret key 사용을 실행 전에 차단합니다.

## 기존 브라우저 데이터 가져오기

기존 데이터가 저장된 **같은 컴퓨터, 같은 브라우저 프로필, 같은 GitHub Pages 주소**에서 진행합니다.

1. 위 SQL에서 허용한 본인 Google 계정으로 로그인합니다.
2. 본인 계정에만 `이 브라우저에서 기존 기록을 발견했습니다` 안내가 나타납니다.
3. **기존 기록 가져오기**를 누릅니다.
4. DB 함수가 Google 로그인 제공자와 허용 이메일을 서버에서 다시 검사합니다.
5. 데이터 저장과 1회 사용 완료 처리가 하나의 DB 트랜잭션으로 성공한 뒤에만 기존 `excelJobs`가 사용자별 로컬 백업 키로 이동합니다.
6. 이후 집 컴퓨터에서 같은 Google 계정으로 로그인하면 동일한 기록이 표시됩니다.

다른 Google 계정에는 이전 버튼이 나타나지 않으며, 함수를 직접 호출해도 DB에서 거부합니다. 원격 방문자의 브라우저에는 사용자의 `localStorage`가 존재하지 않으므로 가져올 데이터 자체가 없습니다.

다만 기존 `localStorage`는 원래 암호화된 저장소가 아닙니다. 같은 컴퓨터와 같은 브라우저 프로필을 물리적으로 사용하는 사람은 개발자 도구로 기존 값을 확인할 수 있으므로, 배포 후 본인 계정으로 먼저 이전하는 것이 중요합니다.

브라우저 저장소는 사이트 주소별로 격리됩니다. 기존 데이터를 `localhost`, 로컬 파일 또는 다른 도메인에서 작성했다면 GitHub Pages 주소에서는 자동 발견할 수 없습니다.

## 데이터 안전

- 새 기록은 더 이상 `localStorage`를 원본 저장소로 사용하지 않습니다.
- 서류 작성 체크 상태도 Supabase에 저장되어 다른 기기와 동기화됩니다.
- 다른 사용자의 행은 RLS가 읽기·수정·삭제를 거부합니다.
- 일반 사용자는 이전용 `legacy_id`, 소유자 ID와 생성 시각을 직접 쓰거나 수정할 권한이 없습니다.
- 상단의 **내 데이터 백업** 버튼으로 언제든 JSON 백업을 받을 수 있습니다.
- 사용자 입력은 `innerHTML`로 렌더링하지 않으며 채용 링크는 `http`와 `https`만 허용합니다.
- DB에도 길이, 상태값, 링크 형식과 사용자 소유권 제약조건이 적용됩니다.
- 외부 Supabase 브라우저 라이브러리는 정확한 버전으로 고정하고 SRI 무결성 검사를 적용했습니다.
