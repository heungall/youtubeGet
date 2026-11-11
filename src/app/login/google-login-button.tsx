"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "./actions";

export function GoogleLoginButton({ returnTo, disabled }: { returnTo: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(signInWithGoogle, { error: null });
  return <form action={action} className="mt-7 space-y-4">
    <input type="hidden" name="next" value={returnTo} />
    {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-800">{state.error}</p>}
    <Button type="submit" disabled={disabled || pending} variant="outline" className="h-12 w-full">{pending ? "Google로 이동 중…" : "Google 계정으로 계속하기"}</Button>
  </form>;
}
