import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getConfigurationStatus, readSupabaseConfig } from "@/lib/config";
import { supabaseFetch } from "@/lib/supabase/transport";
import { sessionCookieOptions } from "@/lib/supabase/cookies";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  if (getConfigurationStatus(process.env).supabase !== "configured") return response;
  const config = readSupabaseConfig(process.env);
  const client = createServerClient(config.url, config.key, {
    global: { fetch: supabaseFetch },
    cookieOptions: sessionCookieOptions(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        const previousCookies = response.cookies.getAll();
        response = NextResponse.next({ request });
        previousCookies.forEach((cookie) => response.cookies.set(cookie));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([name, value]) => response.headers.set(name, value));
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  let authenticated = false;
  try {
    const { data, error } = await client.auth.getClaims();
    authenticated = !error && !!data?.claims?.sub;
  } catch {
    // 인증 서버 장애가 있어도 보호된 화면의 접근을 허용하지 않습니다.
  }
  if (!authenticated && !["/login", "/settings"].includes(request.nextUrl.pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    const redirected = NextResponse.redirect(login);
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
    for (const header of ["cache-control", "expires", "pragma"]) {
      const value = response.headers.get(header);
      if (value) redirected.headers.set(header, value);
    }
    return redirected;
  }
  return response;
}
