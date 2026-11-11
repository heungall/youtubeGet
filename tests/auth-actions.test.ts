import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ signIn: vi.fn(), signOut: vi.fn(), client: vi.fn(), revalidate: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocked.client }));
vi.mock("next/cache", () => ({ revalidatePath: mocked.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocked.redirect }));
import { login, logout } from "@/app/login/actions";

function credentials() {
  const form = new FormData(); form.set("email", "user@example.com"); form.set("password", "correct password");
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public-test-fixture");
  mocked.client.mockResolvedValue({ auth: { signInWithPassword: mocked.signIn, signOut: mocked.signOut } });
  mocked.signIn.mockResolvedValue({ error: null });
  mocked.signOut.mockResolvedValue({ error: null });
  mocked.redirect.mockImplementation((path: string) => { throw new Error(`redirect:${path}`); });
});

describe("로그인/로그아웃 서버 액션", () => {
  it("잘못된 입력은 외부 인증 요청 전에 차단한다", async () => {
    expect((await login({ error: null }, new FormData())).error).toBeTruthy();
    expect(mocked.client).not.toHaveBeenCalled();
  });
  it("인증 실패 시 공급자 내부 오류나 비밀번호를 노출하지 않는다", async () => {
    mocked.signIn.mockResolvedValue({ error: { message: "private-provider-message", status: 400 } });
    const state = await login({ error: null }, credentials());
    expect(state.error).toBeTruthy();
    expect(JSON.stringify(state)).not.toMatch(/private-provider-message|correct password/);
    expect(mocked.redirect).not.toHaveBeenCalled();
  });
  it("로그인 성공 후 캐시를 무효화하고 앱 내부로 이동한다", async () => {
    const form = credentials(); form.set("next", "/library?page=2");
    await expect(login({ error: null }, form)).rejects.toThrow("redirect:/library?page=2");
    expect(mocked.revalidate).toHaveBeenCalledWith("/", "layout");
  });
  it("로그인 후 외부 주소로 이동하지 않는다", async () => {
    const form = credentials(); form.set("next", "https://evil.example");
    await expect(login({ error: null }, form)).rejects.toThrow("redirect:/");
  });
  it("과다 시도와 네트워크 실패를 안내한다", async () => {
    mocked.signIn.mockResolvedValue({ error: { status: 429 } });
    expect((await login({ error: null }, credentials())).error).toContain("로그인 시도가 많습니다");
    mocked.client.mockRejectedValue(new Error("network"));
    expect((await login({ error: null }, credentials())).error).toContain("인증 서버에 연결하지 못했습니다");
  });
  it("이 기기의 세션만 로그아웃한다", async () => {
    await expect(logout()).rejects.toThrow("redirect:/login");
    expect(mocked.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("로그아웃 실패를 성공으로 표시하지 않는다", async () => {
    mocked.signOut.mockResolvedValue({ error: { message: "network" } });
    await expect(logout()).rejects.toThrow("redirect:/login?notice=signout_failed");
  });
});
