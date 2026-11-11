/** 사용자 요청에 속한 DB/Auth 호출이 무한 대기하지 않도록 제한합니다. */
export function supabaseFetch(input: RequestInfo | URL, init?: RequestInit) {
  const signals = [AbortSignal.timeout(10_000)];
  if (init?.signal) signals.push(init.signal);
  return fetch(input, { ...init, signal: AbortSignal.any(signals), cache: "no-store" });
}
