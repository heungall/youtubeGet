import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspaceSession } from "@/lib/auth/session";
import { safeReturnTo } from "@/lib/auth/input";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "로그인" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string }> }) {
  const params = await searchParams;
  const session = await getWorkspaceSession();
  const returnTo = safeReturnTo(params.next);
  if (session.status === "signed_in" && params.notice !== "signout_failed") redirect(returnTo);
  return <section className="mx-auto max-w-md rounded-2xl border bg-card p-7 md:mt-8 md:p-9">
    <p className="text-xs font-semibold tracking-widest text-primary">WORKSPACE / SIGN IN</p>
    <h1 className="mt-3 text-2xl font-bold">콘텐츠 아카이브 로그인</h1>
    <p className="mt-3 text-sm leading-7 text-muted-foreground">등록된 내부 계정으로 로그인하세요. 영상과 키워드는 사용자별로 저장됩니다.</p>
    {session.status === "setup_required" && <p role="status" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">Supabase 연결 설정이 필요합니다. <Link className="underline" href="/settings">연동 설정 확인</Link></p>}
    {session.status === "unavailable" && <p role="status" className="mt-4 text-sm leading-6 text-amber-900">기존 세션을 확인하지 못했습니다. 다시 로그인하거나 잠시 후 재시도해 주세요.</p>}
    {params.notice === "signout_failed" && <p role="alert" className="mt-4 text-sm leading-6 text-red-800">로그아웃을 완료하지 못했습니다. 다시 시도해 주세요.</p>}
    <LoginForm returnTo={returnTo} disabled={session.status === "setup_required"} />
    <p className="mt-5 border-t pt-4 text-xs leading-6 text-muted-foreground">계정이 없거나 비밀번호를 분실했다면 운영 담당자에게 문의하세요.</p>
  </section>;
}
