import "server-only";
import type { WorkspaceSession } from "@/lib/auth/session";
import { YouTubeClient, YouTubeError } from "./client";
import type { CollectionInput } from "./input";

type Session = Extract<WorkspaceSession, { status: "signed_in" }>;
export type CollectionJob = {
  id: string; job_type: CollectionInput["kind"]; query: string; cursor: string | null;
  status: "pending" | "running" | "paused" | "completed" | "failed";
  processed_count: number; skipped_count: number; attempt_count: number;
  search_request_count: number; general_quota_units: number; error_code: string | null;
  created_at: string; lease_expires_at: string | null;
};
type ClaimedJob = CollectionJob & { lease_token: string };

export class CollectionError extends Error {}
const databaseMessage = "수집 DB를 처리하지 못했습니다. 새 SQL 적용과 연결 상태를 확인한 뒤 다시 시도해 주세요.";
export async function loadCollection(session: Session) {
  const [jobs, maintenance] = await Promise.all([
    session.client.from("sync_jobs").select("id,job_type,query,cursor,status,processed_count,skipped_count,attempt_count,search_request_count,general_quota_units,error_code,created_at,lease_expires_at")
      .eq("owner_id", session.user.id).in("job_type", ["search", "channel_uploads"]).order("created_at", { ascending: false }).limit(20).returns<CollectionJob[]>(),
    session.client.rpc("archive_maintenance_ready"),
  ]);
  if (jobs.error || maintenance.error) return null;
  return { jobs: jobs.data ?? [], maintenanceReady: maintenance.data === true, checkedAt: Date.now() };
}

export async function createCollectionJob(session: Session, input: CollectionInput): Promise<string> {
  const maintenance = await session.client.rpc("archive_maintenance_ready");
  if (maintenance.error) throw new CollectionError(databaseMessage);
  if (maintenance.data !== true) throw new CollectionError("보관 기한 자동 정리가 준비되지 않았습니다. 새 SQL과 maintenance.sql을 적용해 주세요.");
  const { data, error } = await session.client.from("sync_jobs").insert({ owner_id: session.user.id, job_type: input.kind, query: input.query })
    .select("id").single<{ id: string }>();
  if (error || !data) throw new CollectionError(databaseMessage);
  return data.id;
}

export async function runCollectionPage(session: Session, id: string): Promise<void> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) throw new YouTubeError("not_configured");
  const cleanup = await session.client.rpc("purge_expired_archive");
  if (cleanup.error) throw new CollectionError(databaseMessage);
  const { data, error } = await session.client.rpc("claim_collection_job", { p_job_id: id });
  if (error || !data) {
    if (error?.message.includes("job_busy")) throw new CollectionError("이미 수집 중입니다. 현재 요청이 끝난 뒤 다시 시도해 주세요.");
    if (error?.message.includes("job_cooldown")) throw new CollectionError("연속 요청을 줄이기 위해 수집 시작 후 10초 간격으로 진행합니다. 잠시 후 다시 시도해 주세요.");
    if (error?.message.includes("maintenance_required")) throw new CollectionError("보관 기한 자동 정리를 설정한 후 수집할 수 있습니다.");
    if (error?.message.includes("job_not_available")) throw new CollectionError("수집 작업이 없거나 이미 완료되었습니다. 목록을 새로고침해 주세요.");
    throw new CollectionError(databaseMessage);
  }
  const job = data as ClaimedJob;
  try {
    const youtube = new YouTubeClient(key, async (endpoint) => {
      const result = await session.client.rpc("record_collection_call", { p_job_id: id, p_token: job.lease_token, p_endpoint: endpoint });
      if (result.error) throw new CollectionError("수집 요청 상태를 저장하지 못했습니다. 같은 페이지를 재시도해 주세요.");
    });
    const page = await youtube.collect({ kind: job.job_type, query: job.query }, job.cursor);
    const result = await session.client.rpc("commit_collection_page", {
      p_job_id: id, p_token: job.lease_token, p_channels: page.channels, p_videos: page.videos,
      p_requested_ids: page.requestedIds, p_next_cursor: page.nextCursor, p_source_channel_id: page.sourceChannelId,
    });
    if (result.error) throw new CollectionError("영상 저장 결과를 확인하지 못했습니다. 수집 내역을 새로고침한 뒤 이어서 진행해 주세요.");
  } catch (cause) {
    const code = cause instanceof YouTubeError ? cause.code : "storage_failed";
    const message = cause instanceof YouTubeError || cause instanceof CollectionError ? cause.message : databaseMessage;
    // 원격 원문 오류·키·URL은 기록하지 않습니다. 실패 기록이 안 되어도 lease가 만료되면 재시도할 수 있습니다.
    await session.client.rpc("fail_collection_job", { p_job_id: id, p_token: job.lease_token, p_code: code, p_message: message }).then(() => {}, () => {});
    throw new CollectionError(message);
  }
}
