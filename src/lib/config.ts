type Environment = Record<string, string | undefined>;
type ConfigState = "missing" | "invalid" | "configured";

function privilegedKey(value: string) {
  if (value.startsWith("sb_secret_")) return true;
  try {
    const payload = value.split(".")[1];
    if (!payload) return false;
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded.role === "service_role";
  } catch { return false; }
}

function validSupabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return !url.username && !url.password && !url.search && !url.hash
      && (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)));
  } catch {
    return false;
  }
}

/** 값 대신 상태만 반환합니다. configured는 실제 연결 성공을 뜻하지 않습니다. */
export function getConfigurationStatus(env: Environment) {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const supabase: ConfigState = !url || !key ? "missing" : validSupabaseUrl(url) && !privilegedKey(key) ? "configured" : "invalid";
  return {
    supabase,
    youtube: env.YOUTUBE_API_KEY?.trim() ? "configured" as const : "missing" as const,
  };
}

export function readSupabaseConfig(env: Environment) {
  if (getConfigurationStatus(env).supabase !== "configured") {
    throw new Error("Supabase 환경변수 설정을 확인해 주세요.");
  }
  return { url: env.SUPABASE_URL!.trim(), key: env.SUPABASE_PUBLISHABLE_KEY!.trim() };
}
