"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getConfigurationStatus, readSupabaseConfig } from "@/lib/config";
import { safeReturnTo, type LoginState } from "@/lib/auth/input";
import { appOrigin, googleCallbackUrl, OAUTH_RETURN_COOKIE, validGoogleAuthorizeUrl } from "@/lib/auth/oauth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sessionCookieOptions } from "@/lib/supabase/cookies";

export async function signInWithGoogle(_previousState: LoginState, form: FormData): Promise<LoginState> {
  if (getConfigurationStatus(process.env).supabase !== "configured") return { error: "서버의 Supabase 연결 설정이 필요합니다." };
  let authorizeUrl: string;
  try {
    const origin = appOrigin(process.env, (await headers()).get("origin"));
    const client = await createSupabaseServerClient();
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: googleCallbackUrl(origin),
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error || !validGoogleAuthorizeUrl(data.url, readSupabaseConfig(process.env).url)) {
      return { error: "Google 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요." };
    }
    authorizeUrl = data.url!;
    (await cookies()).set(OAUTH_RETURN_COOKIE, safeReturnTo(form.get("next")), {
      ...sessionCookieOptions(), path: "/auth/callback", maxAge: 600,
    });
  } catch {
    return { error: "Google 로그인을 시작하지 못했습니다. 연결 상태와 로그인 설정을 확인해 주세요." };
  }
  // 서버 액션의 cookies()에 기록된 PKCE verifier도 이 리다이렉트 응답으로 전달됩니다.
  redirect(authorizeUrl);
}

export async function logout(): Promise<void> {
  let failed = false;
  try {
    const client = await createSupabaseServerClient();
    const { error } = await client.auth.signOut({ scope: "local" });
    failed = !!error;
  } catch {
    failed = true;
  }
  revalidatePath("/", "layout");
  redirect(failed ? "/login?notice=signout_failed" : "/login");
}
