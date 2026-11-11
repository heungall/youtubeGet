import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const A = "10000000-0000-4000-8000-000000000001";
const B = "10000000-0000-4000-8000-000000000002";
const channel = `UC${"a".repeat(22)}`;
const video = "abcdefghijk";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    grant usage on schema public, auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`);
  for (const file of ["202611110001_initial_archive.sql", "202611110002_youtube_collection.sql"]) {
    await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
  }
  await db.query("insert into auth.users values ($1),($2)", [A, B]);
});
beforeEach(async () => {
  await db.exec("reset role; truncate public.channels, public.sync_jobs cascade;");
  // PGlite는 pg_cron 실행 엔진을 제공하지 않습니다. 준비 확인 함수의 실제 SQL은 첫 테스트에서 별도 실행합니다.
  await db.exec("create or replace function public.archive_maintenance_ready() returns boolean language sql security definer set search_path = '' as $$ select true $$;");
  await asUser(A);
});
afterAll(async () => { await db?.close(); });
async function asUser(owner: string) {
  await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]); await db.exec("set role authenticated");
}
async function job() { return (await db.query<{ id: string }>("insert into public.sync_jobs(job_type,query) values ('search','기도') returning id")).rows[0].id; }
async function claim(id: string) { return (await db.query<{ lease_token: string }>("select * from public.claim_collection_job($1)", [id])).rows[0].lease_token; }
async function commit(id: string, token: string, options: { videos?: unknown[]; next?: string | null; requested?: string[] } = {}) {
  const videos = options.videos ?? [{ youtube_video_id: video, youtube_channel_id: channel, title: "공개 영상", description: "설명", published_at: "2026-11-10T00:00:00Z", caption_indicator: "available" }];
  return db.query("select public.commit_collection_page($1,$2,$3::jsonb,$4::jsonb,$5::text[],$6,null)", [id, token, JSON.stringify([{ youtube_channel_id: channel, name: "채널", uploads_playlist_id: "uploads" }]), JSON.stringify(videos), options.requested ?? [video], options.next ?? null]);
}
async function cooldown() { await db.query("update public.sync_jobs set started_at = now() - interval '11 seconds'"); }

describe("수집 트랜잭션과 소유권", () => {
  it("정기 삭제가 없으면 수집을 차단한다", async () => {
    const migration = readFileSync(new URL("../supabase/migrations/202611110002_youtube_collection.sql", import.meta.url), "utf8");
    const start = migration.indexOf("create function public.archive_maintenance_ready()");
    const end = migration.indexOf("create function public.claim_collection_job");
    await db.exec("reset role");
    await db.exec(migration.slice(start, end).replace("create function", "create or replace function"));
    await asUser(A);
    expect((await db.query("select public.archive_maintenance_ready() as ready")).rows).toEqual([{ ready: false }]);
    await expect(claim(await job())).rejects.toThrow("maintenance_required");
  });
  it("원자적으로 영상을 저장한 후 커서만 이동한다", async () => {
    const id = await job(); const token = await claim(id); await commit(id, token, { next: "page2" });
    expect((await db.query("select cursor,status,processed_count,lease_token from public.sync_jobs where id=$1", [id])).rows).toEqual([{ cursor: "page2", status: "paused", processed_count: 1, lease_token: null }]);
    expect((await db.query("select caption_indicator,transcript_status from public.videos")).rows).toEqual([{ caption_indicator: "available", transcript_status: "not_requested" }]);
    const due = (await db.query<{ days: number }>("select extract(epoch from refresh_due_at-last_fetched_at)/86400 as days from public.videos")).rows[0];
    expect(Number(due.days)).toBe(29);
  });
  it("중간 행 저장 실패 시 영상·채널·커서 모두 롤백한다", async () => {
    const id = await job(); const token = await claim(id);
    await expect(commit(id, token, { videos: [
      { youtube_video_id: video, youtube_channel_id: channel, title: "첫 영상", caption_indicator: "available" },
      { youtube_video_id: "invalid", youtube_channel_id: channel, title: "잘못된 영상", caption_indicator: "available" },
    ], requested: [video, "invalid"], next: "page2" })).rejects.toMatchObject({ code: "23514" });
    expect((await db.query("select * from public.videos")).rows).toEqual([]); expect((await db.query("select * from public.channels")).rows).toEqual([]);
    expect((await db.query("select cursor,status,processed_count from public.sync_jobs where id=$1", [id])).rows).toEqual([{ cursor: null, status: "running", processed_count: 0 }]);
  });
  it("첫 채널 페이지에서 본인 채널을 연결하고 동기화 시간을 기록한다", async () => {
    const id = (await db.query<{ id: string }>("insert into public.sync_jobs(job_type,query) values ('channel_uploads','@channel') returning id")).rows[0].id;
    const token = await claim(id);
    await db.query("select public.commit_collection_page($1,$2,$3::jsonb,'[]'::jsonb,'{}'::text[],null,$4)", [id, token, JSON.stringify([{ youtube_channel_id: channel, name: "채널", uploads_playlist_id: "uploads" }]), channel]);
    expect((await db.query("select j.status,j.processed_count,c.youtube_channel_id,c.last_synced_at is not null as synced from public.sync_jobs j join public.channels c on c.id=j.channel_id and c.owner_id=j.owner_id")).rows).toEqual([{ status: "completed", processed_count: 0, youtube_channel_id: channel, synced: true }]);
  });
  it("재수집 시 영상 ID와 사용자 편집·자막 확보 상태를 보존한다", async () => {
    const first = await job(); await commit(first, await claim(first));
    await db.query("update public.videos set transcript_status='manual'");
    await db.query("insert into public.video_categories(video_id,category_id,origin,confirmed_at) select v.id,c.id,'manual',now() from public.videos v cross join public.categories c where c.code='K01'");
    await db.query("insert into public.video_analyses(video_id,version,summary_source,summary) select id,1,'manual','사용자 요약' from public.videos");
    const original = (await db.query("select id from public.videos")).rows;
    await cooldown(); const second = await job(); await commit(second, await claim(second), { videos: [{ youtube_video_id: video, youtube_channel_id: channel, title: "새 제목", caption_indicator: "unavailable" }] });
    expect((await db.query("select id from public.videos")).rows).toEqual(original);
    expect((await db.query("select title,transcript_status from public.videos")).rows).toEqual([{ title: "새 제목", transcript_status: "manual" }]);
    expect((await db.query("select summary from public.video_analyses")).rows).toEqual([{ summary: "사용자 요약" }]); expect((await db.query("select origin from public.video_categories")).rows).toEqual([{ origin: "manual" }]);
  });
  it("동시 실행과10초 이내 재요청을 차단한다", async () => {
    const first = await job(); const token = await claim(first); const second = await job();
    await expect(claim(first)).rejects.toThrow("job_busy"); await expect(claim(second)).rejects.toThrow("job_busy");
    await db.query("select public.fail_collection_job($1,$2,'unavailable','안전한 오류')", [first, token]);
    await expect(claim(second)).rejects.toThrow("job_cooldown");
  });
  it("실패와 오래된 응답에서 커서를 보존하고 임대 만료 후 재개한다", async () => {
    const id = await job(); const oldToken = await claim(id);
    await db.query("update public.sync_jobs set lease_expires_at=now()-interval '1 second', started_at=now()-interval '3 minutes' where id=$1", [id]);
    const newToken = await claim(id); expect(newToken).not.toBe(oldToken);
    await expect(commit(id, oldToken)).rejects.toThrow("lease_lost");
    await db.query("select public.fail_collection_job($1,$2,'unavailable','실패')", [id, oldToken]);
    expect((await db.query("select status from public.sync_jobs where id=$1", [id])).rows).toEqual([{ status: "running" }]);
    await commit(id, newToken); await expect(claim(id)).rejects.toThrow("job_not_available");
  });
  it("검색과 일반 API 쿼터를 구분하여 기록한다", async () => {
    const id = await job(); const token = await claim(id);
    for (const endpoint of ["search", "videos", "channels"]) await db.query("select public.record_collection_call($1,$2,$3)", [id, token, endpoint]);
    expect((await db.query("select search_request_count,general_quota_units,estimated_quota_units from public.sync_jobs")).rows).toEqual([{ search_request_count: 1, general_quota_units: 2, estimated_quota_units: 3 }]);
  });
  it("타인 작업 claim/저장/오류 기록을 차단한다", async () => {
    const id = await job(); const token = await claim(id); await asUser(B);
    await expect(claim(id)).rejects.toThrow("job_not_available"); await expect(commit(id, token)).rejects.toThrow("lease_lost");
    await db.query("select public.fail_collection_job($1,$2,'attack','변조')", [id, token]);
    expect((await db.query("select * from public.sync_jobs")).rows).toEqual([]);
    await asUser(A); expect((await db.query("select status from public.sync_jobs")).rows).toEqual([{ status: "running" }]);
  });
  it("삭제/비공개가 된 기존 영상과 연결 분류를 삭제한다", async () => {
    const first = await job(); await commit(first, await claim(first)); await cooldown();
    const second = await job(); await commit(second, await claim(second), { videos: [] });
    expect((await db.query("select * from public.videos")).rows).toEqual([]);
    expect((await db.query("select skipped_count from public.sync_jobs where id=$1", [second])).rows).toEqual([{ skipped_count: 1 }]);
  });
  it("만료 자막·연결 분석을 FK 오류 없이 정리하고 타인 데이터는 보존한다", async () => {
    const first = await job(); await commit(first, await claim(first));
    await db.query("insert into public.transcripts(video_id,source_type,text,status,retention_until) select id,'manual','원문','manual',now()-interval '1 second' from public.videos");
    await db.query("insert into public.video_analyses(video_id,transcript_id,version,status,summary_source) select video_id,id,1,'transcript_analyzed','transcript' from public.transcripts");
    await db.query("update public.videos set transcript_status='manual'");
    await asUser(B); const other = await job(); await commit(other, await claim(other));
    await db.query("update public.videos set refresh_due_at=now()-interval '1 second'");
    await asUser(A); await db.query("select public.purge_expired_archive()");
    expect((await db.query("select * from public.transcripts")).rows).toEqual([]); expect((await db.query("select * from public.video_analyses")).rows).toEqual([]);
    expect((await db.query("select transcript_status from public.videos")).rows).toEqual([{ transcript_status: "not_requested" }]);
    await asUser(B); expect((await db.query("select * from public.videos")).rows).toHaveLength(1);
    await db.query("select public.purge_expired_archive()"); expect((await db.query("select * from public.videos")).rows).toEqual([]);
  });
  it("익명 사용자는 정리/준비 확인/작업 함수를 실행하지 못한다", async () => {
    await db.exec("reset role; set role anon");
    await expect(db.query("select public.purge_expired_archive()")).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select public.archive_maintenance_ready()")).rejects.toMatchObject({ code: "42501" });
    await expect(claim("10000000-0000-4000-8000-000000000003")).rejects.toMatchObject({ code: "42501" });
  });
});
