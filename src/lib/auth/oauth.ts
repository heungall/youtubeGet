type Environment = Record<string, string | undefined>;
export const OAUTH_RETURN_COOKIE = "archive-oauth-return";

/** 서버 액션의 Origin은 Next.js의 동일 출처 검사 후에만 사용합니다. */
export function appOrigin(env: Environment, requestOrigin?: string | null) {
  const candidate = env.APP_URL?.trim() || requestOrigin
    || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : env.NODE_ENV === "development" ? "http://localhost:3000" : null);
  if (!candidate) throw new Error("사이트 주소 설정을 확인해 주세요.");
  const url = new URL(candidate);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:"))
    || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("사이트 주소 설정을 확인해 주세요.");
  }
  return url.origin;
}

export function googleCallbackUrl(origin: string) {
  return new URL("/auth/callback", origin).toString();
}

/** SDK가 만든 Supabase Google 인가 주소로만 이동합니다. */
export function validGoogleAuthorizeUrl(value: string | null, supabaseUrl: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const project = new URL(supabaseUrl);
    return !url.username && !url.password && url.origin === project.origin
      && url.pathname === "/auth/v1/authorize" && url.searchParams.get("provider") === "google";
  } catch { return false; }
}
