import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getConfigurationStatus, readSupabaseConfig } from "@/lib/config";
import { safeReturnTo } from "@/lib/auth/input";
import { OAUTH_RETURN_COOKIE } from "@/lib/auth/oauth";
import { sessionCookieOptions } from "@/lib/supabase/cookies";
import { supabaseFetch } from "@/lib/supabase/transport";

export async function GET(request: NextRequest) {
  // 상대 Location으로 현재 사이트를 유지합니다. 프록시/로컬 호스트 정규화에 의존하지 않습니다.
  // 성공·실패 모두 같은 응답을 사용해 세션/PKCE 정리 쿠키를 잃지 않습니다.
  const response = new NextResponse(null, { status: 307, headers: { Location: "/login?notice=oauth_failed" } });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  const returnTo = safeReturnTo(request.cookies.get(OAUTH_RETURN_COOKIE)?.value);
  response.cookies.set(OAUTH_RETURN_COOKIE, "", { ...sessionCookieOptions(), path: "/auth/callback", maxAge: 0 });
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  if (params.has("error") || !code || code.length > 4096 || params.getAll("code").length !== 1
    || getConfigurationStatus(process.env).supabase !== "configured") return response;
  try {
    const config = readSupabaseConfig(process.env);
    const client = createServerClient(config.url, config.key, {
      global: { fetch: supabaseFetch },
      cookieOptions: sessionCookieOptions(),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([name, value]) => response.headers.set(name, value));
        },
      },
    });
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      response.headers.set("Location", returnTo);
    }
  } catch {
    // 인증 코드나 공급자의 오류 설명을 화면/로그에 남기지 않습니다.
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
