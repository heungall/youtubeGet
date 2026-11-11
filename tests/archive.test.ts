import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceSession } from "@/lib/auth/session";

vi.mock("server-only", () => ({}));
import { loadLibrary, loadOverview } from "@/lib/archive";

type Session = Extract<WorkspaceSession, { status: "signed_in" }>;
function sessionWithFetch(fetcher: typeof fetch): Session {
  return { status: "signed_in", user: { id: "user-a", email: "user-a@example.com" }, client: createClient("https://example.supabase.co", "public-test-fixture", { global: { fetch: fetcher }, auth: { persistSession: false, autoRefreshToken: false } }) };
}

describe("실제 Supabase SDK의 조회 요청", () => {
  it("소유자·공개·갱신 기한을 제한하고 50개 페이지와 필터를 요청한다", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("[]", { status: 200, headers: { "Content-Range": "*/0" } }));
    const result = await loadLibrary(sessionWithFetch(fetcher), { query: "10%,(a)", caption: "available", page: 2 });
    expect(result).toEqual({ videos: [], count: 0 });
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.searchParams.get("owner_id")).toBe("eq.user-a");
    expect(url.searchParams.get("availability")).toBe("eq.public");
    expect(url.searchParams.get("refresh_due_at")).toMatch(/^gt\./);
    expect(url.searchParams.get("caption_indicator")).toBe("eq.available");
    expect(url.searchParams.get("title")).toBe("ilike.%10\\%,(a)%");
    expect(url.searchParams.get("offset")).toBe("50");
    expect(url.searchParams.get("limit")).toBe("50");
    expect(url.searchParams.get("or")).toBeNull();
    expect(url.searchParams.get("order")).toContain("id.asc");
  });
  it("DB 오류를 빈 검색 결과로 표시하지 않는다", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ code: "42P01", message: "relation missing" }), { status: 404 }));
    expect(await loadLibrary(sessionWithFetch(fetcher), { query: "", caption: "all", page: 1 })).toBeNull();
  });
  it("네트워크 실패를 오류 상태로 반환한다", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("network"));
    expect(await loadLibrary(sessionWithFetch(fetcher), { query: "", caption: "all", page: 1 })).toBeNull();
  });
  it("실제 HEAD 응답의 count를 사용하고 본인 데이터만 센다", async () => {
    const requests: URL[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = new URL(String(input)); requests.push(url);
      expect(init?.method).toBe("HEAD");
      const table = url.pathname.split("/").pop();
      return new Response(null, { status: 200, headers: { "Content-Range": `*/${table === "categories" ? 13 : 2}` } });
    });
    expect(await loadOverview(sessionWithFetch(fetcher))).toEqual({ videos: 2, channels: 2, campaigns: 2, categories: 13 });
    expect(requests.filter((url) => !url.pathname.endsWith("categories")).every((url) => url.searchParams.get("owner_id") === "eq.user-a")).toBe(true);
  });
  it("13개 시드가 없거나 조회 일부가 실패하면 연결 성공으로 보고하지 않는다", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200, headers: { "Content-Range": "*/0" } }));
    expect(await loadOverview(sessionWithFetch(fetcher))).toBeNull();
  });
});
