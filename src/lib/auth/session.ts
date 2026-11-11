import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getConfigurationStatus } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeReturnTo } from "@/lib/auth/input";

type SessionClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
export type WorkspaceSession =
  | { status: "setup_required" | "signed_out" | "unavailable"; user: null; client: null }
  | { status: "signed_in"; user: { id: string; email: string }; client: SessionClient };

/** React cache는 한 서버 렌더 요청 안에서만 검증 결과를 재사용합니다. */
export const getWorkspaceSession = cache(async (): Promise<WorkspaceSession> => {
  if (getConfigurationStatus(process.env).supabase !== "configured") {
    return { status: "setup_required", user: null, client: null };
  }
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.auth.getClaims();
    if (error) return { status: error.name === "AuthSessionMissingError" ? "signed_out" : "unavailable", user: null, client: null };
    if (!data?.claims?.sub) return { status: "signed_out", user: null, client: null };
    return { status: "signed_in", user: { id: data.claims.sub, email: typeof data.claims.email === "string" ? data.claims.email : "로그인 사용자" }, client };
  } catch {
    return { status: "unavailable", user: null, client: null };
  }
});

/** Proxy를 통과하지 않는 서버 호출에서도 인증을 확인합니다. */
export async function requireWorkspaceSession(returnTo: string) {
  const session = await getWorkspaceSession();
  if (session.status !== "signed_in") redirect(`/login?next=${encodeURIComponent(safeReturnTo(returnTo))}`);
  return session;
}
