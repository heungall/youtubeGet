export type LoginState = { error: string | null };

/** 허용된 앱 화면으로만 이동합니다. 외부 주소 및 로그인 루프를 허용하지 않습니다. */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    if (/[\\\u0000-\u001f\u007f]/.test(decodeURIComponent(value))) return "/";
    const url = new URL(value, "https://archive.invalid");
    if (url.origin !== "https://archive.invalid" || !["/", "/library", "/collect", "/keywords", "/settings"].includes(url.pathname)) return "/";
    return url.pathname + url.search;
  } catch {
    return "/";
  }
}
