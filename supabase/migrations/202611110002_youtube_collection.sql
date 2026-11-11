-- 기존 프로젝트에는 001 다음으로 적용합니다. 함수는 별도 명시한 준비 확인 외 모두 RLS를 따릅니다.
begin;

-- 채널은 첫 페이지의 공식 API 응답을 저장할 때 연결합니다.
alter table public.sync_jobs drop constraint sync_jobs_check;
alter table public.sync_jobs add column lease_token uuid;
alter table public.sync_jobs add column lease_expires_at timestamptz;
alter table public.sync_jobs add column search_request_count integer not null default 0 check (search_request_count >= 0);
alter table public.sync_jobs add column general_quota_units integer not null default 0 check (general_quota_units >= 0);
alter table public.sync_jobs add column skipped_count integer not null default 0 check (skipped_count >= 0);

-- RLS 적용: 일반 로그인 사용자는 본인 데이터만, cron의 DB 소유자는 전체 만료 데이터를 정리합니다.
-- 외부 API 메타데이터가 삭제되면 연결 분류/자막/분석/선정 연결도 FK에 따라 삭제됩니다.
create function public.purge_expired_archive() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.video_analyses a using public.transcripts t
    where a.transcript_id = t.id and t.retention_until <= now();
  delete from public.video_categories c using public.transcripts t
    where c.video_id = t.video_id and c.owner_id = t.owner_id and c.origin = 'transcript' and t.retention_until <= now();
  delete from public.video_detail_keywords k using public.transcripts t
    where k.video_id = t.video_id and k.owner_id = t.owner_id and k.origin = 'transcript' and t.retention_until <= now();
  delete from public.transcripts where retention_until <= now();
  update public.videos v set transcript_status = 'not_requested'
    where v.transcript_status in ('available', 'manual')
      and not exists (select 1 from public.transcripts t where t.video_id = v.id and t.owner_id = v.owner_id);
  delete from public.videos where refresh_due_at <= now();
  delete from public.channels where refresh_due_at <= now();
  delete from public.sync_jobs where created_at <= now() - interval '29 days'
    and (lease_expires_at is null or lease_expires_at <= now());
end;
$$;

-- cron.job 조회 권한이나 타인 정보 없이 정기 삭제 준비 여부만 반환합니다.
create function public.archive_maintenance_ready() returns boolean
language plpgsql security definer set search_path = '' as $$
declare ready boolean := false;
begin
  if exists (select 1 from pg_catalog.pg_extension where extname = 'pg_cron') then
    execute $q$select exists (select 1 from cron.job
      where jobname = 'youtube-archive-retention' and active
        and schedule = '17 * * * *' and database = current_database() and username = current_user
        and command = 'select public.purge_expired_archive();')$q$ into ready;
  end if;
  return ready;
end;
$$;

create function public.claim_collection_job(p_job_id uuid) returns public.sync_jobs
language plpgsql security invoker set search_path = '' as $$
declare job public.sync_jobs;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.archive_maintenance_ready() then raise exception 'maintenance_required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 0));
  select * into job from public.sync_jobs where id = p_job_id and owner_id = auth.uid() for update;
  if not found or job.job_type not in ('search', 'channel_uploads') or job.status = 'completed' then raise exception 'job_not_available'; end if;
  if exists (select 1 from public.sync_jobs where owner_id = auth.uid() and status = 'running' and lease_expires_at > now()) then raise exception 'job_busy'; end if;
  if exists (select 1 from public.sync_jobs where owner_id = auth.uid() and started_at > now() - interval '10 seconds') then raise exception 'job_cooldown'; end if;
  update public.sync_jobs set status = 'running', lease_token = gen_random_uuid(), lease_expires_at = now() + interval '2 minutes',
    attempt_count = attempt_count + 1, started_at = now(), error_code = null, error_message = null
    where id = job.id and owner_id = auth.uid() returning * into job;
  return job;
end;
$$;

create function public.record_collection_call(p_job_id uuid, p_token uuid, p_endpoint text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if p_endpoint not in ('search', 'channels', 'playlistItems', 'videos') then raise exception 'invalid_endpoint'; end if;
  update public.sync_jobs set estimated_quota_units = estimated_quota_units + 1,
    search_request_count = search_request_count + case when p_endpoint = 'search' then 1 else 0 end,
    general_quota_units = general_quota_units + case when p_endpoint = 'search' then 0 else 1 end
    where id = p_job_id and owner_id = auth.uid() and lease_token = p_token and status = 'running' and lease_expires_at > now();
  if not found then raise exception 'lease_lost'; end if;
end;
$$;

create function public.commit_collection_page(
  p_job_id uuid, p_token uuid, p_channels jsonb, p_videos jsonb,
  p_requested_ids text[], p_next_cursor text, p_source_channel_id text
) returns void language plpgsql security invoker set search_path = '' as $$
declare job public.sync_jobs; item jsonb; channel_uuid uuid; source_uuid uuid; count_saved integer := 0; count_skipped integer := 0;
begin
  select * into job from public.sync_jobs where id = p_job_id and owner_id = auth.uid() for update;
  if not found or job.status <> 'running' or job.lease_token is distinct from p_token or job.lease_expires_at <= now() then raise exception 'lease_lost'; end if;
  if p_channels is null or p_videos is null or p_requested_ids is null
    or jsonb_typeof(p_channels) <> 'array' or jsonb_typeof(p_videos) <> 'array'
    or jsonb_array_length(p_channels) > 50 or jsonb_array_length(p_videos) > 50
    or cardinality(p_requested_ids) > 50 or length(p_next_cursor) > 2048
    or (p_next_cursor is not null and p_next_cursor = job.cursor) then raise exception 'invalid_page'; end if;
  for item in select value from jsonb_array_elements(p_channels) loop
    insert into public.channels (owner_id, youtube_channel_id, name, uploads_playlist_id, last_fetched_at, refresh_due_at)
    values (auth.uid(), item->>'youtube_channel_id', item->>'name', item->>'uploads_playlist_id', now(), now() + interval '29 days')
    on conflict (owner_id, youtube_channel_id) do update set name = excluded.name,
      uploads_playlist_id = excluded.uploads_playlist_id, last_fetched_at = excluded.last_fetched_at, refresh_due_at = excluded.refresh_due_at;
  end loop;
  for item in select value from jsonb_array_elements(p_videos) loop
    if not ((item->>'youtube_video_id') = any(p_requested_ids)) then raise exception 'invalid_video'; end if;
    select id into channel_uuid from public.channels where owner_id = auth.uid() and youtube_channel_id = item->>'youtube_channel_id';
    if channel_uuid is null then raise exception 'channel_missing'; end if;
    insert into public.videos (owner_id, youtube_video_id, channel_id, title, description, thumbnail_url, published_at, caption_indicator, availability, last_fetched_at, refresh_due_at)
    values (auth.uid(), item->>'youtube_video_id', channel_uuid, item->>'title', coalesce(item->>'description', ''), item->>'thumbnail_url',
      (item->>'published_at')::timestamptz, (item->>'caption_indicator')::public.caption_indicator, 'public', now(), now() + interval '29 days')
    on conflict (owner_id, youtube_video_id) do update set channel_id = excluded.channel_id, title = excluded.title,
      description = excluded.description, thumbnail_url = excluded.thumbnail_url, published_at = excluded.published_at,
      caption_indicator = excluded.caption_indicator, availability = 'public', last_fetched_at = excluded.last_fetched_at, refresh_due_at = excluded.refresh_due_at;
    count_saved := count_saved + 1;
  end loop;
  -- 상세 응답에서 사라지거나 비공개인 영상은 기존 정보도 삭제합니다. 실패 응답에는 호출하지 않습니다.
  delete from public.videos v where v.owner_id = auth.uid() and v.youtube_video_id = any(p_requested_ids)
    and not exists (select 1 from jsonb_array_elements(p_videos) e where e->>'youtube_video_id' = v.youtube_video_id);
  count_skipped := cardinality(p_requested_ids) - count_saved;
  if job.job_type = 'channel_uploads' then
    select id into source_uuid from public.channels where owner_id = auth.uid() and youtube_channel_id = p_source_channel_id;
    if source_uuid is null then raise exception 'source_channel_missing'; end if;
    update public.channels set last_synced_at = now() where id = source_uuid and owner_id = auth.uid();
  end if;
  update public.sync_jobs set channel_id = source_uuid, cursor = p_next_cursor,
    status = case when p_next_cursor is null then 'completed'::public.sync_status else 'paused'::public.sync_status end,
    processed_count = processed_count + count_saved, skipped_count = skipped_count + count_skipped,
    completed_at = case when p_next_cursor is null then now() else null end,
    lease_token = null, lease_expires_at = null, error_code = null, error_message = null
    where id = job.id and owner_id = auth.uid();
end;
$$;

create function public.fail_collection_job(p_job_id uuid, p_token uuid, p_code text, p_message text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.sync_jobs set status = 'failed', error_code = left(p_code, 100), error_message = left(p_message, 500),
    lease_token = null, lease_expires_at = null
    where id = p_job_id and owner_id = auth.uid() and status = 'running' and lease_token = p_token;
end;
$$;

revoke all on function public.purge_expired_archive(), public.archive_maintenance_ready(), public.claim_collection_job(uuid),
  public.record_collection_call(uuid, uuid, text), public.commit_collection_page(uuid, uuid, jsonb, jsonb, text[], text, text),
  public.fail_collection_job(uuid, uuid, text, text) from public, anon;
grant execute on function public.purge_expired_archive(), public.archive_maintenance_ready(), public.claim_collection_job(uuid),
  public.record_collection_call(uuid, uuid, text), public.commit_collection_page(uuid, uuid, jsonb, jsonb, text[], text, text),
  public.fail_collection_job(uuid, uuid, text, text) to authenticated;

comment on column public.sync_jobs.processed_count is '중복 갱신을 포함한 저장 건수. 라이브러리의 고유 영상 수와 다름.';
comment on column public.sync_jobs.estimated_quota_units is '전송 전 호출 추정 합계. 검색 전용/일반 쿼터는 별도 열. 실제 소비는 Cloud Console 확인.';
comment on column public.videos.refresh_due_at is '재수집 시점부터 29일. 매시간 삭제로 30일 보관 상한에 여유를 둠.';
notify pgrst, 'reload schema';
commit;
