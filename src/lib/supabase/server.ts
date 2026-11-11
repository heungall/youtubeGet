import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readSupabaseConfig } from "@/lib/config";
import { supabaseFetch } from "@/lib/supabase/transport";
import { sessionCookieOptions } from "@/lib/supabase/cookies";

/** 사용자 세션을 사용합니다. RLS를 우회하는 service-role 키는 사용하지 않습니다. */
export async function createSupabaseServerClient() {
  const config = readSupabaseConfig(process.env);
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    global: { fetch: supabaseFetch },
    cookieOptions: sessionCookieOptions(),
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components는 쿠키를 쓸 수 없습니다. src/proxy.ts가 세션을 갱신합니다.
        }
      },
    },
  });
}
