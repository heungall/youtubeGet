import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceSession } from "@/lib/auth/session";
vi.mock("server-only", () => ({}));
import { createCollectionJob, loadCollection, runCollectionPage } from "@/lib/youtube/collection";

type Session = Extract<WorkspaceSession, { status: "signed_in" }>;
const id = "10000000-0000-4000-8000-000000000001";
const token = "20000000-0000-4000-8000-000000000001";
const job = { id, lease_token: token, job_type: "search", query: "기도", cursor: "previous" };
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }); }
function session(fetcher: typeof fetch): Session {
  return { status: "signed_in", user: { id: "user-a", email: "a@example.com" }, client: createClient("https://example.supabase.co", "public-test-fixture", { global: { fetch: fetcher }, auth: { persistSession: false, autoRefreshToken: false } }) };
}
let api: ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(() => {
  vi.stubEnv("YOUTUBE_API_KEY", "fixture-only");
  api = vi.fn<typeof fetch>().mockResolvedValue(json({ items: [], nextPageToken: "next" })); vi.stubGlobal("fetch", api);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("수집 서비스와 실제 Supabase SDK 요청", () => {
  it("요청을 기록하고 응답 저장 RPC에 이전 작업 토큰/커서를 전달한다", async () => {
    const requests: { method: string; body: Record<string, unknown> }[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const method = new URL(String(input)).pathname.split("/").pop()!;
      requests.push({ method, body: JSON.parse(String(init?.body)) });
      return json(method === "claim_collection_job" ? job : null);
    });
    await runCollectionPage(session(fetcher), id);
    expect(requests.map((request) => request.method)).toEqual(["purge_expired_archive", "claim_collection_job", "record_collection_call", "commit_collection_page"]);
    expect(requests[2].body).toEqual({ p_job_id: id, p_token: token, p_endpoint: "search" });
    expect(requests[3].body).toEqual({ p_job_id: id, p_token: token, p_channels: [], p_videos: [], p_requested_ids: [], p_next_cursor: "next", p_source_channel_id: null });
    expect(new URL(String(api.mock.calls[0][0])).searchParams.get("pageToken")).toBe("previous");
  });
  it("YouTube 실패 시 저장 RPC 없이 안전한 오류만 기록한다", async () => {
    api.mockResolvedValue(json({ error: { message: "secret URL and key", errors: [{ reason: "quotaExceeded" }] } }, 403));
    const requests: { method: string; body: Record<string, unknown> }[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const method = new URL(String(input)).pathname.split("/").pop()!; requests.push({ method, body: JSON.parse(String(init?.body)) });
      return json(method === "claim_collection_job" ? job : null);
    });
    await expect(runCollectionPage(session(fetcher), id)).rejects.toThrow("사용량 한도");
    expect(requests.map((r) => r.method)).not.toContain("commit_collection_page");
    expect(requests.at(-1)).toMatchObject({ method: "fail_collection_job", body: { p_code: "quota_exceeded", p_token: token } });
    expect(JSON.stringify(requests)).not.toContain("secret");
  });
  it("저장 오류에는 API를 재호출하거나 커서를 별도 변경하지 않는다", async () => {
    const methods: string[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const method = new URL(String(input)).pathname.split("/").pop()!; methods.push(method);
      return method === "commit_collection_page" ? json({ message: "private-database-message", code: "23514" }, 400) : json(method === "claim_collection_job" ? job : null);
    });
    await expect(runCollectionPage(session(fetcher), id)).rejects.toThrow("저장 결과");
    expect(api).toHaveBeenCalledTimes(1); expect(methods.at(-1)).toBe("fail_collection_job");
  });
  it.each(["job_busy", "job_cooldown", "job_not_available", "maintenance_required"])("%s인 경우 API 요청 전에 차단한다", async (message) => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => String(input).endsWith("claim_collection_job") ? json({ message, code: "P0001" }, 400) : json(null));
    await expect(runCollectionPage(session(fetcher), id)).rejects.toThrow(); expect(api).not.toHaveBeenCalled();
  });
  it("요청 기록 실패 시 API를 호출하지 않고 실패 작업을 남긴다", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const method = String(input).split("/").pop();
      return method === "record_collection_call" ? json({ message: "lease_lost" }, 400) : json(method === "claim_collection_job" ? job : null);
    });
    await expect(runCollectionPage(session(fetcher), id)).rejects.toThrow("요청 상태"); expect(api).not.toHaveBeenCalled();
  });
  it("준비 확인 후 본인 소유 작업만 생성한다", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      if (String(input).includes("archive_maintenance_ready")) return json(true);
      expect(JSON.parse(String(init?.body))).toEqual({ owner_id: "user-a", job_type: "search", query: "기도" }); return json({ id });
    });
    expect(await createCollectionJob(session(fetcher), { kind: "search", query: "기도" })).toBe(id);
  });
  it("최근 내역 조회에 소유자와 개수 제한을 적용한다", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("archive_maintenance_ready")) return json(true);
      expect(url.searchParams.get("owner_id")).toBe("eq.user-a"); expect(url.searchParams.get("limit")).toBe("20"); return json([]);
    });
    expect(await loadCollection(session(fetcher))).toMatchObject({ jobs: [], maintenanceReady: true, checkedAt: expect.any(Number) });
  });
  it("스케줄러가 없거나 DB 오류이면 생성/성공 표시를 하지 않는다", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(false));
    await expect(createCollectionJob(session(fetcher), { kind: "search", query: "기도" })).rejects.toThrow("보관 기한"); expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockImplementation(async () => json({ message: "not installed" }, 404));
    expect(await loadCollection(session(fetcher))).toBeNull();
  });
});
