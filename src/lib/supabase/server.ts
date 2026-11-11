import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readSupabaseConfig } from "@/lib/config";

/** 사용자 세션을 사용합니다. RLS를 우회하는 service-role 키는 사용하지 않습니다. */
export async function createSupabaseServerClient() {
  const config = readSupabaseConfig(process.env);
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components는 쿠키를 쓸 수 없습니다. 인증 연동 시 Route Handler에서 갱신합니다.
        }
      },
    },
  });
}
