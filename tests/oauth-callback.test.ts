import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocked = vi.hoisted(() => ({ exchange: vi.fn(), createClient: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocked.createClient }));
import { GET } from "@/app/auth/callback/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public-test-fixture");
  vi.stubEnv("APP_URL", "");
  mocked.createClient.mockReturnValue({ auth: { exchangeCodeForSession: mocked.exchange } });
  mocked.exchange.mockResolvedValue({ data: { session: { user: { id: "user-a" } } }, error: null });
});

describe("Google OAuth 콜백", () => {
  it("인증 코드를 세션으로 교환하고 원래 앱 화면으로 이동한다", async () => {
    const response = await GET(new NextRequest("https://archive.example/auth/callback?code=test-code", { headers: { cookie: "archive-oauth-return=%2Flibrary%3Fpage%3D2" } }));
    expect(mocked.exchange).toHaveBeenCalledWith("test-code");
    expect(response.headers.get("location")).toBe("/library?page=2");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.cookies.get("archive-oauth-return")?.maxAge).toBe(0);
  });
  it.each(["", "?error=access_denied&error_description=private-message", "?code=a&code=b"])("취소·누락·중복 코드를 인증 실패로 처리한다: %s", async (query) => {
    const response = await GET(new NextRequest(`https://archive.example/auth/callback${query}`));
    expect(response.headers.get("location")).toBe("/login?notice=oauth_failed");
    expect(mocked.createClient).not.toHaveBeenCalled();
  });
  it("실패 시 쿠키 정리도 성공 시 세션 저장도 리다이렉트에 보존한다", async () => {
    mocked.createClient.mockImplementation((_url, _key, options) => {
      mocked.exchange.mockImplementation(async () => {
        options.cookies.setAll([{ name: "sb-pkce", value: "", options: { path: "/", maxAge: 0 } }, { name: "sb-session", value: "test-session", options: { httpOnly: true, secure: true, sameSite: "lax", path: "/" } }], { "Pragma": "no-cache" });
        return { data: { session: {} }, error: null };
      });
      return { auth: { exchangeCodeForSession: mocked.exchange } };
    });
    const response = await GET(new NextRequest("https://archive.example/auth/callback?code=test-code"));
    expect(response.cookies.get("sb-session")?.value).toBe("test-session");
    expect(response.cookies.get("sb-pkce")?.maxAge).toBe(0);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });
  it("교환 오류·네트워크 실패·빈 세션은 로그인 실패로 처리한다", async () => {
    for (const result of [{ data: { session: null }, error: null }, { data: { session: null }, error: { message: "private-message" } }]) {
      mocked.exchange.mockResolvedValue(result);
      expect((await GET(new NextRequest("https://archive.example/auth/callback?code=x"))).headers.get("location")).toContain("notice=oauth_failed");
    }
    mocked.exchange.mockRejectedValue(new Error("network"));
    expect((await GET(new NextRequest("https://archive.example/auth/callback?code=x"))).headers.get("location")).toContain("notice=oauth_failed");
  });
  it("외부 복귀 주소나 임의 forwarded host로 이동하지 않는다", async () => {
    const response = await GET(new NextRequest("https://archive.example/auth/callback?code=x&next=https%3A%2F%2Fevil.example", { headers: { "x-forwarded-host": "evil.example", cookie: "archive-oauth-return=https%3A%2F%2Fevil.example" } }));
    expect(response.headers.get("location")).toBe("/");
  });
});
