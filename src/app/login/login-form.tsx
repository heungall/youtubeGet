"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { login } from "./actions";

export function LoginForm({ returnTo, disabled }: { returnTo: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(login, { error: null });
  return <form action={action} className="mt-6 space-y-4">
    <input type="hidden" name="next" value={returnTo} />
    <div><label htmlFor="email" className="text-sm font-medium">이메일</label><input id="email" name="email" type="email" autoComplete="username" required maxLength={254} disabled={disabled || pending} className="mt-2 h-11 w-full rounded-lg border bg-white px-3 text-sm disabled:bg-muted" /></div>
    <div><label htmlFor="password" className="text-sm font-medium">비밀번호</label><input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024} disabled={disabled || pending} className="mt-2 h-11 w-full rounded-lg border bg-white px-3 text-sm disabled:bg-muted" /></div>
    {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-800">{state.error}</p>}
    <Button type="submit" disabled={disabled || pending} className="w-full">{pending ? "로그인 중…" : "로그인"}</Button>
  </form>;
}
