import { createServerClient } from "@supabase/ssr";
import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { sessionCookieOptions } from "@/lib/supabase/cookies";
import { GET } from "@/app/auth/callback/route";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("실제 SDK가 PKCE verifier 쿠키를 쓰고 콜백이 동일 verifier로 세션을 만든다", async () => {
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public-test-fixture");
  vi.stubEnv("APP_URL", "");
  const jar = new Map<string, string>();
  const client = createServerClient("https://example.supabase.co", "public-test-fixture", {
    cookieOptions: sessionCookieOptions(),
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (values) => values.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const started = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "https://archive.example/auth/callback", skipBrowserRedirect: true } });
  expect(started.error).toBeNull();
  const authorize = new URL(started.data.url!);
  expect(authorize.searchParams.get("code_challenge_method")).toBe("s256");
  expect(authorize.searchParams.get("redirect_to")).toBe("https://archive.example/auth/callback");
  expect(jar.size).toBeGreaterThan(0);

  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "user-a", exp: now + 3600, iat: now, role: "authenticated", aud: "authenticated" })}.test-signature`;
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    expect(url.pathname).toBe("/auth/v1/token");
    expect(url.searchParams.get("grant_type")).toBe("pkce");
    const body = JSON.parse(String(init?.body));
    expect(body.auth_code).toBe("one-use-test-code");
    expect(createHash("sha256").update(body.code_verifier).digest("base64url")).toBe(authorize.searchParams.get("code_challenge"));
    return new Response(JSON.stringify({ access_token: accessToken, refresh_token: "test-refresh-token", token_type: "bearer", expires_in: 3600, user: { id: "user-a", email: "google-user@example.com", app_metadata: { provider: "google" } } }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetcher);
  const cookie = [...jar].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("; ");
  const response = await GET(new NextRequest("https://archive.example/auth/callback?code=one-use-test-code", { headers: { cookie } }));
  expect(response.headers.get("location")).toBe("/");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(response.cookies.getAll().some((entry) => entry.name.startsWith("sb-example-auth-token") && entry.value && entry.maxAge !== 0 && !entry.name.includes("verifier"))).toBe(true);
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
});
