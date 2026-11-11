import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ oauth: vi.fn(), signOut: vi.fn(), client: vi.fn(), headers: vi.fn(), cookieSet: vi.fn(), revalidate: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocked.client }));
vi.mock("next/cache", () => ({ revalidatePath: mocked.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocked.redirect }));
vi.mock("next/headers", () => ({ headers: mocked.headers, cookies: async () => ({ set: mocked.cookieSet }) }));
import { signInWithGoogle, logout } from "@/app/login/actions";

const providerUrl = "https://example.supabase.co/auth/v1/authorize?provider=google&code_challenge=test";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public-test-fixture");
  vi.stubEnv("APP_URL", "");
  mocked.headers.mockResolvedValue(new Headers({ origin: "https://archive.example" }));
  mocked.client.mockResolvedValue({ auth: { signInWithOAuth: mocked.oauth, signOut: mocked.signOut } });
  mocked.oauth.mockResolvedValue({ data: { url: providerUrl }, error: null });
  mocked.signOut.mockResolvedValue({ error: null });
  mocked.redirect.mockImplementation((path: string) => { throw new Error(`redirect:${path}`); });
});

describe("Google 로그인/로그아웃 서버 액션", () => {
  it("이메일·비밀번호 없이 Google 인증을 시작하고 서버에서 리다이렉트한다", async () => {
    const form = new FormData(); form.set("next", "/library?page=2");
    await expect(signInWithGoogle({ error: null }, form)).rejects.toThrow(`redirect:${providerUrl}`);
    expect(mocked.oauth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: "https://archive.example/auth/callback", skipBrowserRedirect: true, queryParams: { prompt: "select_account" } } });
    expect(mocked.cookieSet).toHaveBeenCalledWith("archive-oauth-return", "/library?page=2", expect.objectContaining({ httpOnly: true, path: "/auth/callback", maxAge: 600 }));
    expect(mocked.revalidate).not.toHaveBeenCalled();
  });
  it("허용되지 않는 복귀 주소를 쿠키에 저장하지 않는다", async () => {
    const form = new FormData(); form.set("next", "https://evil.example");
    await expect(signInWithGoogle({ error: null }, form)).rejects.toThrow("redirect:");
    expect(mocked.cookieSet.mock.calls[0][1]).toBe("/");
  });
  it("미설정 환경에서는 인증 요청 전에 안내한다", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    expect((await signInWithGoogle({ error: null }, new FormData())).error).toContain("연결 설정");
    expect(mocked.client).not.toHaveBeenCalled();
  });
  it("공급자의 내부 오류를 화면에 노출하지 않는다", async () => {
    mocked.oauth.mockResolvedValue({ data: { url: null }, error: { message: "private-provider-message" } });
    const state = await signInWithGoogle({ error: null }, new FormData());
    expect(state.error).toBeTruthy();
    expect(JSON.stringify(state)).not.toContain("private-provider-message");
  });
  it("잘못된 인가 주소와 네트워크 오류를 처리한다", async () => {
    mocked.oauth.mockResolvedValue({ data: { url: "https://evil.example" }, error: null });
    expect((await signInWithGoogle({ error: null }, new FormData())).error).toBeTruthy();
    expect(mocked.redirect).not.toHaveBeenCalled();
    mocked.client.mockRejectedValue(new Error("network"));
    expect((await signInWithGoogle({ error: null }, new FormData())).error).toBeTruthy();
  });
  it("이 기기의 세션만 로그아웃하고 레이아웃을 갱신한다", async () => {
    await expect(logout()).rejects.toThrow("redirect:/login");
    expect(mocked.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocked.revalidate).toHaveBeenCalledWith("/", "layout");
  });
  it("로그아웃 실패를 성공으로 표시하지 않는다", async () => {
    mocked.signOut.mockResolvedValue({ error: { message: "network" } });
    await expect(logout()).rejects.toThrow("redirect:/login?notice=signout_failed");
  });
});
