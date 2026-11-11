import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CATEGORIES } from "@/lib/categories";

const A = "10000000-0000-4000-8000-000000000001";
const B = "10000000-0000-4000-8000-000000000002";
const channelA = "20000000-0000-4000-8000-000000000001";
const channelB = "20000000-0000-4000-8000-000000000002";
const videoA = "30000000-0000-4000-8000-000000000001";
const videoB = "30000000-0000-4000-8000-000000000002";
const ownedTables = ["channels", "videos", "video_categories", "detail_keywords", "video_detail_keywords", "transcripts", "video_analyses", "campaigns", "campaign_videos", "sync_jobs"];
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  // Supabase Auth 경계만 대체합니다. 마이그레이션과 PostgreSQL RLS는 실제 실행합니다.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  await db.exec(readFileSync(new URL("../supabase/migrations/202611110001_initial_archive.sql", import.meta.url), "utf8"));
  await db.query("insert into auth.users (id) values ($1), ($2)", [A, B]);
  for (const [i, owner] of [A, B].entries()) {
    const suffix = i + 1;
    const channel = i === 0 ? channelA : channelB;
    const video = i === 0 ? videoA : videoB;
    const keyword = `40000000-0000-4000-8000-00000000000${suffix}`;
    const campaign = `50000000-0000-4000-8000-00000000000${suffix}`;
    const transcript = `60000000-0000-4000-8000-00000000000${suffix}`;
    await db.query("insert into public.channels (id, owner_id, youtube_channel_id, name) values ($1, $2, $3, '테스트 채널')", [channel, owner, `UC${String(suffix).repeat(22)}`]);
    await db.query("insert into public.videos (id, owner_id, youtube_video_id, channel_id, title) values ($1, $2, 'abcdefghijk', $3, '기도의 시간')", [video, owner, channel]);
    await db.query("insert into public.video_categories (owner_id, video_id, category_id, origin) select $1, $2, id, 'metadata' from public.categories where code = 'K01'", [owner, video]);
    await db.query("insert into public.detail_keywords (id, owner_id, display_name) values ($1, $2, '새벽 기도')", [keyword, owner]);
    await db.query("insert into public.video_detail_keywords (owner_id, video_id, keyword_id, origin) values ($1, $2, $3, 'metadata')", [owner, video, keyword]);
    await db.query("insert into public.transcripts (id, owner_id, video_id, source_type, text, status) values ($1, $2, $3, 'manual', '권한 있게 입력한 자막', 'manual')", [transcript, owner, video]);
    await db.query("insert into public.video_analyses (owner_id, video_id, version, status, summary_source, summary) values ($1, $2, 1, 'metadata_only', 'metadata', '제목 설명 기반 초안')", [owner, video]);
    await db.query("insert into public.campaigns (id, owner_id, year_month, name) values ($1, $2, '2026-11', '11월 기획')", [campaign, owner]);
    await db.query("insert into public.campaign_videos (owner_id, campaign_id, video_id) values ($1, $2, $3)", [owner, campaign, video]);
    await db.query("insert into public.sync_jobs (owner_id, channel_id, job_type) values ($1, $2, 'channel_uploads')", [owner, channel]);
  }
});

beforeEach(async () => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [A]);
  await db.exec("set role authenticated");
});

afterAll(async () => { await db?.close(); });

describe("마이그레이션 및 RLS", () => {
  it("13개 카테고리를 요구사항과 동일하게 시드한다", async () => {
    const result = await db.query("select code, name from public.categories order by code");
    expect(result.rows).toEqual(CATEGORIES);
  });

  it.each(ownedTables)("%s: 본인 행만 조회하고 타인 수정/삭제를 차단한다", async (table) => {
    const visible = await db.query<{ owner_id: string }>(`select owner_id from public.${table}`);
    expect(visible.rows.length).toBeGreaterThan(0);
    expect(visible.rows.every((row) => row.owner_id === A)).toBe(true);
    const updated = await db.query(`update public.${table} set owner_id = $1 where owner_id = $2 returning owner_id`, [A, B]);
    expect(updated.rows).toEqual([]);
    const deleted = await db.query(`delete from public.${table} where owner_id = $1 returning owner_id`, [B]);
    expect(deleted.rows).toEqual([]);
  });

  it.each([...ownedTables, "categories"])("%s: 익명 사용자의 조회를 차단한다", async (table) => {
    await db.exec("reset role; set role anon");
    await expect(db.query(`select * from public.${table}`)).rejects.toMatchObject({ code: "42501" });
  });

  it("로그인 역할이어도 UID가 없으면 사용자 데이터를 읽지 못한다", async () => {
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
    expect((await db.query("select * from public.videos")).rows).toEqual([]);
  });

  it("타인 소유 행 삽입과 본인 소유권 변경을 차단한다", async () => {
    await expect(db.query("insert into public.channels (owner_id, youtube_channel_id, name) values ($1, 'UCzzzzzzzzzzzzzzzzzzzzzz', '공격')", [B])).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("update public.channels set owner_id = $1 where id = $2", [B, channelA])).rejects.toMatchObject({ code: "42501" });
  });

  it("인증 사용자도 고정 카테고리를 변경할 수 없다", async () => {
    await expect(db.query("update public.categories set name = '변조' where code = 'K01'")).rejects.toMatchObject({ code: "42501" });
  });

  it("타인 채널에 본인 영상을 연결할 수 없다", async () => {
    await expect(db.query("insert into public.videos (youtube_video_id, channel_id, title) values ('crossowner1', $1, '테스트')", [channelB])).rejects.toMatchObject({ code: "23503" });
  });

  it("타인 영상에 분류와 월별 선정을 연결할 수 없다", async () => {
    await expect(db.query("insert into public.video_categories (video_id, category_id, origin) select $1, id, 'manual' from public.categories where code = 'K02'", [videoB])).rejects.toMatchObject({ code: "23503" });
    await expect(db.query("insert into public.campaign_videos (campaign_id, video_id) values ('50000000-0000-4000-8000-000000000001', $1)", [videoB])).rejects.toMatchObject({ code: "23503" });
  });
});

describe("아카이브 데이터 정합성", () => {
  it("동일 YouTube ID를 upsert해도 영상·분류·분석을 중복 생성하지 않는다", async () => {
    await db.query(`insert into public.videos (youtube_video_id, channel_id, title)
      values ('abcdefghijk', $1, '갱신된 제목')
      on conflict (owner_id, youtube_video_id) do update set title = excluded.title`, [channelA]);
    expect((await db.query("select title from public.videos")).rows).toEqual([{ title: "갱신된 제목" }]);
    expect((await db.query("select * from public.video_categories")).rows).toHaveLength(1);
    expect((await db.query("select * from public.video_analyses")).rows).toHaveLength(1);
  });

  it("월별 중복 선정과 잘못된 월을 거부한다", async () => {
    await expect(db.query("insert into public.campaign_videos (campaign_id, video_id) values ('50000000-0000-4000-8000-000000000001', $1)", [videoA])).rejects.toMatchObject({ code: "23505" });
    await expect(db.query("insert into public.campaigns (year_month, name) values ('2026-13', '잘못된 월')")).rejects.toMatchObject({ code: "23514" });
  });

  it("디테일 키워드의 공백·대소문자를 정규화해 중복을 방지한다", async () => {
    await db.query("insert into public.detail_keywords (display_name) values ('  Prayer   Time  ')");
    expect((await db.query("select display_name, normalized_name from public.detail_keywords where normalized_name = 'prayer time'")).rows).toEqual([{ display_name: "Prayer Time", normalized_name: "prayer time" }]);
    await expect(db.query("insert into public.detail_keywords (display_name) values ('prayer time')")).rejects.toMatchObject({ code: "23505" });
  });

  it("자막 표시와 원문 상태를 독립적으로 저장한다", async () => {
    expect((await db.query("select caption_indicator, transcript_status from public.videos where id = $1", [videoA])).rows).toEqual([{ caption_indicator: "unknown", transcript_status: "not_requested" }]);
    await db.query("update public.videos set caption_indicator = 'available' where id = $1", [videoA]);
    expect((await db.query("select transcript_status from public.videos where id = $1", [videoA])).rows).toEqual([{ transcript_status: "not_requested" }]);
  });

  it("자동 제안과 사용자 확정을 구분한다", async () => {
    expect((await db.query("select confirmed_at from public.video_categories")).rows).toEqual([{ confirmed_at: null }]);
    await db.query("update public.video_categories set confirmed_at = now() where video_id = $1", [videoA]);
    expect((await db.query<{ confirmed_at: unknown }>("select confirmed_at from public.video_categories")).rows[0].confirmed_at).not.toBeNull();
  });

  it("자막 없는 자막 기반 분석과 높은 신뢰도의 메타데이터 분석을 거부한다", async () => {
    await expect(db.query("insert into public.video_analyses (video_id, version, summary_source) values ($1, 2, 'transcript')", [videoA])).rejects.toMatchObject({ code: "23514" });
    await expect(db.query("insert into public.video_analyses (video_id, version, summary_source, confidence) values ($1, 2, 'metadata', 'high')", [videoA])).rejects.toMatchObject({ code: "23514" });
  });

  it("빈 검색어와 자막을 거부한다", async () => {
    await expect(db.query("insert into public.sync_jobs (job_type) values ('search')")).rejects.toMatchObject({ code: "23514" });
    await expect(db.query("insert into public.transcripts (video_id, source_type, text, status) values ($1, 'manual', '  ', 'manual')", [videoA])).rejects.toMatchObject({ code: "23514" });
  });

  it("수정 시 updated_at을 DB가 갱신한다", async () => {
    await db.query("update public.channels set updated_at = '2000-01-01' where id = $1", [channelA]);
    const result = await db.query<{ fresh: boolean }>("select updated_at > '2000-01-02'::timestamptz as fresh from public.channels where id = $1", [channelA]);
    expect(result.rows[0].fresh).toBe(true);
  });
});
