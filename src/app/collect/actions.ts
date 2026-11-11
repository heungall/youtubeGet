"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceSession } from "@/lib/auth/session";
import { readCollectionInput, validJobId } from "@/lib/youtube/input";
import { CollectionError, createCollectionJob, runCollectionPage } from "@/lib/youtube/collection";
import { YouTubeError } from "@/lib/youtube/client";

export type CollectionState = { error: string | null; message: string | null };
const failure = (cause: unknown): CollectionState => ({ error: cause instanceof CollectionError || cause instanceof YouTubeError ? cause.message : "수집 연결을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.", message: null });
function refresh() {
  for (const path of ["/collect", "/library", "/"]) revalidatePath(path);
}

export async function startCollection(_previous: CollectionState, form: FormData): Promise<CollectionState> {
  const session = await requireWorkspaceSession("/collect");
  const input = readCollectionInput(form);
  if (!input) return { error: "검색어(200자 이내) 또는 올바른 채널 ID·@핸들·채널 주소를 입력해 주세요.", message: null };
  if (form.get("consent") !== "yes") return { error: "수집 정보와 보관·삭제 안내를 확인해 주세요.", message: null };
  if (!process.env.YOUTUBE_API_KEY?.trim()) return failure(new YouTubeError("not_configured"));
  try {
    const id = await createCollectionJob(session, input);
    await runCollectionPage(session, id);
    refresh();
    return { error: null, message: "첫 페이지를 저장했습니다. 수집 내역에서 다음 페이지를 이어서 가져올 수 있습니다." };
  } catch (cause) { refresh(); return failure(cause); }
}

export async function continueCollection(_previous: CollectionState, form: FormData): Promise<CollectionState> {
  const session = await requireWorkspaceSession("/collect");
  const id = form.get("jobId");
  if (!validJobId(id)) return { error: "올바른 수집 작업을 선택해 주세요.", message: null };
  try {
    await runCollectionPage(session, id);
    refresh();
    return { error: null, message: "페이지를 저장했습니다." };
  } catch (cause) { refresh(); return failure(cause); }
}
