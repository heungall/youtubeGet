"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getConfigurationStatus } from "@/lib/config";
import { readLoginInput, safeReturnTo, type LoginState } from "@/lib/auth/input";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function login(_previousState: LoginState, form: FormData): Promise<LoginState> {
  const input = readLoginInput(form);
  if (!input) return { error: "이메일과 비밀번호를 확인해 주세요." };
  if (getConfigurationStatus(process.env).supabase !== "configured") return { error: "서버의 Supabase 연결 설정이 필요합니다." };
  try {
    const client = await createSupabaseServerClient();
    const { error } = await client.auth.signInWithPassword(input);
    if (error) return { error: error.status === 429 ? "로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요." : "로그인하지 못했습니다. 계정 정보와 이메일 인증 여부를 확인해 주세요." };
  } catch {
    return { error: "인증 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
  revalidatePath("/", "layout");
  redirect(safeReturnTo(form.get("next")));
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
