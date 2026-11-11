import { describe, expect, it } from "vitest";
import { getConfigurationStatus, readSupabaseConfig } from "@/lib/config";

describe("서버 설정 검증", () => {
  it("키가 없어도 화면에 사용할 상태를 반환한다", () => {
    expect(getConfigurationStatus({})).toEqual({ supabase: "missing", youtube: "missing" });
  });

  it.each(["not-a-url", "javascript:alert(1)", "http://example.com", "https://user:secret@example.com", "https://example.com/?key=secret"])("안전하지 않은 주소를 거부한다: %s", (url) => {
    expect(getConfigurationStatus({ SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: "key" }).supabase).toBe("invalid");
  });

  it("상태 객체에 키 또는 주소 값을 노출하지 않는다", () => {
    const status = getConfigurationStatus({ SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "private-test-value", YOUTUBE_API_KEY: "youtube-test-value" });
    expect(status).toEqual({ supabase: "configured", youtube: "configured" });
    expect(JSON.stringify(status)).not.toMatch(/test-value|project\.supabase/);
  });

  it("로컬 Supabase 주소를 허용한다", () => {
    expect(readSupabaseConfig({ SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_PUBLISHABLE_KEY: "local" })).toEqual({ url: "http://127.0.0.1:54321", key: "local" });
  });

  it("누락된 설정 오류에 비밀값을 넣지 않는다", () => {
    expect(() => readSupabaseConfig({ SUPABASE_PUBLISHABLE_KEY: "secret" })).toThrow("Supabase 환경변수 설정을 확인해 주세요.");
  });

  it("RLS를 우회하는 secret/service-role 키를 거부한다", () => {
    const serviceKey = `test.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`;
    for (const key of ["sb_secret_test_fixture", serviceKey]) {
      expect(getConfigurationStatus({ SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: key }).supabase).toBe("invalid");
    }
  });
});
