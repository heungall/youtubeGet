import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocked = vi.hoisted(() => ({ getClaims: vi.fn(), createServerClient: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocked.createServerClient }));
import { updateSession } from "@/lib/supabase/proxy";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public-test-fixture");
  mocked.createServerClient.mockReset();
  mocked.getClaims.mockReset();
  mocked.createServerClient.mockReturnValue({ auth: { getClaims: mocked.getClaims } });
  mocked.getClaims.mockResolvedValue({ data: null, error: null });
});

describe("인증 Proxy", () => {
  it("미설정 환경에서는 기존 설정 안내 화면을 유지한다", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    const response = await updateSession(new NextRequest("https://archive.example/library"));
    expect(response.status).toBe(200);
    expect(mocked.createServerClient).not.toHaveBeenCalled();
  });
  it("비로그인 사용자를 원래 검색 조건과 함께 로그인으로 보낸다", async () => {
    const response = await updateSession(new NextRequest("https://archive.example/library?q=prayer&page=2"));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/library?q=prayer&page=2");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocked.createServerClient.mock.calls[0][2].cookieOptions).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });
  it.each(["/login", "/settings"])("%s는 로그인 없이 접근 가능하다", async (path) => {
    expect((await updateSession(new NextRequest(`https://archive.example${path}`))).status).toBe(200);
  });
  it("검증된 사용자만 보호된 화면에 접근한다", async () => {
    mocked.getClaims.mockResolvedValue({ data: { claims: { sub: "user-a" } }, error: null });
    expect((await updateSession(new NextRequest("https://archive.example/library"))).status).toBe(200);
  });
  it("인증 장애에도 보호된 화면을 열지 않는다", async () => {
    mocked.getClaims.mockRejectedValue(new Error("network"));
    expect((await updateSession(new NextRequest("https://archive.example/library"))).status).toBe(307);
  });
  it("갱신/삭제 쿠키와 캐시 헤더를 리다이렉트 응답에도 보존한다", async () => {
    mocked.createServerClient.mockImplementation((_url, _key, options) => {
      mocked.getClaims.mockImplementation(async () => {
        options.cookies.setAll([{ name: "sb-test-token", value: "", options: { path: "/", maxAge: 0, httpOnly: true } }], { "Pragma": "no-cache", "Expires": "0" });
        return { data: null, error: null };
      });
      return { auth: { getClaims: mocked.getClaims } };
    });
    const response = await updateSession(new NextRequest("https://archive.example/"));
    expect(response.cookies.get("sb-test-token")?.value).toBe("");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("expires")).toBe("0");
  });
});
