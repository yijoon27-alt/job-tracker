-- Supabase Dashboard > SQL Editor에서 한 번 실행하세요.
-- 테이블이나 사용자 데이터를 삭제하지 않고 필요한 구조와 정책을 생성합니다.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.legacy_migration_owners (
  email text primary key check (email = lower(email)),
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id)
);

revoke all on table private.legacy_migration_owners from public, anon, authenticated;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company text not null check (char_length(company) between 1 and 200),
  role text not null check (char_length(role) between 1 and 200),
  deadline date not null,
  link text not null default '' check (char_length(link) <= 2048 and (link = '' or link ~* '^https?://')),
  jd text not null default '' check (char_length(jd) <= 50000),
  preferred text not null default '' check (char_length(preferred) <= 50000),
  cover_letter text not null default '' check (char_length(cover_letter) <= 200000),
  doc_status text not null default '대기' check (doc_status in ('대기', '합격', '탈락')),
  interview1_date date,
  interview1_result text not null default '미대상' check (interview1_result in ('미대상', '대기', '합격', '탈락')),
  interview2_date date,
  interview2_result text not null default '미대상' check (interview2_result in ('미대상', '대기', '합격', '탈락')),
  final_status text not null default '진행중' check (final_status in ('진행중', '최종합격', '최종탈락')),
  legacy_id text check (char_length(legacy_id) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, legacy_id)
);

create index if not exists jobs_user_id_idx on public.jobs (user_id);

create or replace function public.set_job_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_job_updated_at on public.jobs;
create trigger set_job_updated_at
before update on public.jobs
for each row execute function public.set_job_updated_at();

alter table public.jobs enable row level security;

revoke all on table public.jobs from anon;
revoke all on table public.jobs from authenticated;
grant select, delete on table public.jobs to authenticated;
grant insert (
  user_id, company, role, deadline, link, jd, preferred, cover_letter,
  doc_status, interview1_date, interview1_result, interview2_date,
  interview2_result, final_status
) on table public.jobs to authenticated;
grant update (
  company, role, deadline, link, jd, preferred, cover_letter,
  doc_status, interview1_date, interview1_result, interview2_date,
  interview2_result, final_status
) on table public.jobs to authenticated;

drop policy if exists "Users can read only their jobs" on public.jobs;
create policy "Users can read only their jobs"
on public.jobs for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert only their jobs" on public.jobs;
create policy "Users can insert only their jobs"
on public.jobs for insert
to authenticated
with check ((select auth.uid()) = user_id and legacy_id is null);

drop policy if exists "Users can update only their jobs" on public.jobs;
create policy "Users can update only their jobs"
on public.jobs for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete only their jobs" on public.jobs;
create policy "Users can delete only their jobs"
on public.jobs for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke execute on function public.set_job_updated_at() from public, anon, authenticated;

create or replace function public.can_import_legacy()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and coalesce((select auth.jwt()) -> 'app_metadata' ->> 'provider', '') = 'google'
    and exists (
      select 1
      from private.legacy_migration_owners as owner
      where owner.email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
        and owner.claimed_at is null
    );
$$;

revoke all on function public.can_import_legacy() from public, anon, authenticated;
grant execute on function public.can_import_legacy() to authenticated;

create or replace function public.import_legacy_jobs(payload jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  importing_user_id uuid := (select auth.uid());
  importing_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  auth_provider text := coalesce((select auth.jwt()) -> 'app_metadata' ->> 'provider', '');
  inserted_count integer := 0;
begin
  if importing_user_id is null or auth_provider <> 'google' then
    raise exception using errcode = '42501', message = 'Google authentication is required';
  end if;

  if jsonb_typeof(payload) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Payload must be an array';
  end if;

  if jsonb_array_length(payload) = 0 or jsonb_array_length(payload) > 1000 then
    raise exception using errcode = '22023', message = 'Payload size is not allowed';
  end if;

  update private.legacy_migration_owners
  set claimed_at = now(), claimed_by = importing_user_id
  where email = importing_email
    and claimed_at is null;

  if not found then
    raise exception using errcode = '42501', message = 'This account is not authorized for legacy migration';
  end if;

  insert into public.jobs (
    user_id,
    legacy_id,
    company,
    role,
    deadline,
    link,
    jd,
    preferred,
    cover_letter,
    doc_status,
    interview1_date,
    interview1_result,
    interview2_date,
    interview2_result,
    final_status
  )
  select
    importing_user_id,
    left(legacy.item ->> 'legacy_id', 200),
    left(btrim(legacy.item ->> 'company'), 200),
    left(btrim(legacy.item ->> 'role'), 200),
    (legacy.item ->> 'deadline')::date,
    case
      when coalesce(legacy.item ->> 'link', '') ~* '^https?://' then left(legacy.item ->> 'link', 2048)
      else ''
    end,
    left(coalesce(legacy.item ->> 'jd', ''), 50000),
    left(coalesce(legacy.item ->> 'preferred', ''), 50000),
    left(coalesce(legacy.item ->> 'cover_letter', ''), 200000),
    case when legacy.item ->> 'doc_status' in ('대기', '합격', '탈락')
      then legacy.item ->> 'doc_status' else '대기' end,
    case when coalesce(legacy.item ->> 'interview1_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      then (legacy.item ->> 'interview1_date')::date else null end,
    case when legacy.item ->> 'interview1_result' in ('미대상', '대기', '합격', '탈락')
      then legacy.item ->> 'interview1_result' else '미대상' end,
    case when coalesce(legacy.item ->> 'interview2_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      then (legacy.item ->> 'interview2_date')::date else null end,
    case when legacy.item ->> 'interview2_result' in ('미대상', '대기', '합격', '탈락')
      then legacy.item ->> 'interview2_result' else '미대상' end,
    case when legacy.item ->> 'final_status' in ('진행중', '최종합격', '최종탈락')
      then legacy.item ->> 'final_status' else '진행중' end
  from jsonb_array_elements(payload) as legacy(item)
  where coalesce(legacy.item ->> 'legacy_id', '') <> ''
    and btrim(coalesce(legacy.item ->> 'company', '')) <> ''
    and btrim(coalesce(legacy.item ->> 'role', '')) <> ''
    and coalesce(legacy.item ->> 'deadline', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  on conflict (user_id, legacy_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.import_legacy_jobs(jsonb) from public, anon, authenticated;
grant execute on function public.import_legacy_jobs(jsonb) to authenticated;
