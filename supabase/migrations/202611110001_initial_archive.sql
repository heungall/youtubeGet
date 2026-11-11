-- 사용자 소유 데이터는 owner_id로 격리합니다. 공개 카테고리는 로그인 사용자만 읽습니다.
begin;

create type public.caption_indicator as enum ('available', 'unavailable', 'unknown');
create type public.transcript_status as enum ('not_requested', 'available', 'unavailable', 'failed', 'manual');
create type public.analysis_status as enum ('not_started', 'metadata_only', 'pending', 'transcript_analyzed', 'failed');
create type public.summary_source as enum ('metadata', 'transcript', 'manual');
create type public.keyword_origin as enum ('metadata', 'transcript', 'manual');
create type public.selection_status as enum ('candidate', 'selected', 'excluded');
create type public.sync_status as enum ('pending', 'running', 'paused', 'completed', 'failed');

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^K(0[1-9]|1[0-3])$'),
  name text not null unique
);

insert into public.categories (code, name) values
  ('K01', '기도'), ('K02', '말씀/성경읽기'), ('K03', '내면/신앙'),
  ('K04', '교회/공동체'), ('K05', '사이비/이단'), ('K06', '연애/결혼/가정'),
  ('K07', '인간관계/소통'), ('K08', '일/진로'), ('K09', '돈/재정'),
  ('K10', '질병치료'), ('K11', '새신자반'), ('K12', '세계관'), ('K13', '예배');

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  youtube_channel_id text not null check (youtube_channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
  name text not null,
  uploads_playlist_id text,
  last_synced_at timestamptz,
  last_fetched_at timestamptz not null default now(),
  refresh_due_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, youtube_channel_id),
  unique (id, owner_id)
);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  channel_id uuid not null,
  title text not null,
  description text not null default '',
  thumbnail_url text,
  published_at timestamptz,
  caption_indicator public.caption_indicator not null default 'unknown',
  transcript_status public.transcript_status not null default 'not_requested',
  availability text not null default 'public' check (availability in ('public', 'unavailable', 'unknown')),
  last_fetched_at timestamptz not null default now(),
  refresh_due_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, youtube_video_id),
  unique (id, owner_id),
  foreign key (channel_id, owner_id) references public.channels(id, owner_id) on delete cascade
);

create table public.video_categories (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  video_id uuid not null,
  category_id uuid not null references public.categories(id),
  origin public.keyword_origin not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (video_id, category_id, origin),
  foreign key (video_id, owner_id) references public.videos(id, owner_id) on delete cascade
);

create table public.detail_keywords (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  normalized_name text not null check (char_length(normalized_name) between 1 and 100),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 100),
  category_id uuid references public.categories(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, normalized_name),
  unique (id, owner_id)
);

create function public.normalize_detail_keyword() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.display_name = regexp_replace(btrim(new.display_name), '\s+', ' ', 'g');
  new.normalized_name = lower(new.display_name);
  return new;
end;
$$;

create trigger normalize_detail_keyword before insert or update on public.detail_keywords
  for each row execute function public.normalize_detail_keyword();

create table public.video_detail_keywords (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  video_id uuid not null,
  keyword_id uuid not null,
  origin public.keyword_origin not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (video_id, keyword_id, origin),
  foreign key (video_id, owner_id) references public.videos(id, owner_id) on delete cascade,
  foreign key (keyword_id, owner_id) references public.detail_keywords(id, owner_id) on delete cascade
);

create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  video_id uuid not null,
  source_type text not null check (source_type in ('manual', 'authorized')),
  language text not null default 'ko' check (char_length(language) between 2 and 20),
  text text not null check (char_length(btrim(text)) between 1 and 100000),
  status public.transcript_status not null check (status in ('available', 'manual')),
  obtained_at timestamptz not null default now(),
  retention_until timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, video_id, owner_id),
  foreign key (video_id, owner_id) references public.videos(id, owner_id) on delete cascade
);

create table public.video_analyses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  video_id uuid not null,
  transcript_id uuid,
  version integer not null check (version > 0),
  status public.analysis_status not null default 'not_started',
  summary text not null default '' check (char_length(summary) <= 10000),
  summary_source public.summary_source not null,
  confidence text not null default 'low' check (confidence in ('low', 'medium', 'high')),
  evidence text not null default '',
  model_version text,
  input_hash text,
  error_message text,
  analyzed_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (video_id, version),
  foreign key (video_id, owner_id) references public.videos(id, owner_id) on delete cascade,
  foreign key (transcript_id, video_id, owner_id) references public.transcripts(id, video_id, owner_id),
  check (summary_source <> 'metadata' or confidence = 'low'),
  check (summary_source <> 'transcript' or transcript_id is not null),
  check (status <> 'metadata_only' or summary_source = 'metadata'),
  check (status <> 'transcript_analyzed' or summary_source = 'transcript')
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year_month text not null check (year_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  requested_keywords text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, year_month),
  unique (id, owner_id)
);

create table public.campaign_videos (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  campaign_id uuid not null,
  video_id uuid not null,
  selection_status public.selection_status not null default 'candidate',
  match_score numeric not null default 0 check (match_score >= 0),
  match_reason text[] not null default '{}',
  notes text not null default '' check (char_length(notes) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, video_id),
  foreign key (campaign_id, owner_id) references public.campaigns(id, owner_id) on delete cascade,
  foreign key (video_id, owner_id) references public.videos(id, owner_id) on delete cascade
);

create table public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  channel_id uuid,
  job_type text not null check (job_type in ('search', 'channel_uploads', 'refresh')),
  query text,
  cursor text,
  status public.sync_status not null default 'pending',
  processed_count integer not null default 0 check (processed_count >= 0),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  estimated_quota_units integer not null default 0 check (estimated_quota_units >= 0),
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (channel_id, owner_id) references public.channels(id, owner_id) on delete cascade,
  check (job_type <> 'channel_uploads' or channel_id is not null),
  check (job_type <> 'search' or (query is not null and char_length(btrim(query)) > 0))
);

create index videos_owner_published_idx on public.videos (owner_id, published_at desc);
create index videos_owner_caption_idx on public.videos (owner_id, caption_indicator);
create index videos_channel_owner_idx on public.videos (channel_id, owner_id);
create index videos_refresh_due_idx on public.videos (refresh_due_at);
create index channels_refresh_due_idx on public.channels (refresh_due_at);
create index video_categories_owner_category_idx on public.video_categories (owner_id, category_id);
create index detail_keywords_owner_category_idx on public.detail_keywords (owner_id, category_id);
create index video_detail_keywords_owner_keyword_idx on public.video_detail_keywords (owner_id, keyword_id);
create index transcripts_owner_video_idx on public.transcripts (owner_id, video_id);
create index transcripts_retention_idx on public.transcripts (retention_until);
create index analyses_owner_video_idx on public.video_analyses (owner_id, video_id, version desc);
create index analyses_input_hash_idx on public.video_analyses (owner_id, video_id, input_hash);
create index campaign_videos_owner_video_idx on public.campaign_videos (owner_id, video_id);
create index sync_jobs_owner_status_idx on public.sync_jobs (owner_id, status, created_at desc);

-- 모든 사용자 테이블은 기본 거부하며 본인 행에 대해서만 CRUD를 허용합니다.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'channels', 'videos', 'video_categories', 'detail_keywords', 'video_detail_keywords',
    'transcripts', 'video_analyses', 'campaigns', 'campaign_videos', 'sync_jobs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    execute format(
      'create policy owner_access on public.%I for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)',
      table_name
    );
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name
    );
  end loop;
end;
$$;

alter table public.categories enable row level security;
revoke all on table public.categories from anon, authenticated;
grant select on table public.categories to authenticated;
create policy categories_read on public.categories for select to authenticated using (true);

comment on column public.videos.refresh_due_at is 'YouTube API 메타데이터 갱신/삭제 기한. 스케줄러는 별도 구현 필요.';
comment on column public.campaign_videos.match_score is '정렬용 추정 점수이며 정확도 백분율이 아님.';
comment on column public.video_categories.confirmed_at is 'NULL이면 자동 제안 또는 미확정 분류.';
comment on column public.video_analyses.input_hash is '입력 및 분석 버전 해시. 성공 결과 재사용용, 실패 재시도 허용.';

commit;
