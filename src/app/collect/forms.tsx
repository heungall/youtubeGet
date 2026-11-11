"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { startCollection, continueCollection, type CollectionState } from "./actions";

const initial: CollectionState = { error: null, message: null };
function Feedback({ state }: { state: CollectionState }) {
  return <>{state.error && <p role="alert" className="mt-3 text-sm leading-6 text-red-700">{state.error}</p>}{state.message && <p role="status" className="mt-3 text-sm leading-6 text-primary">{state.message}</p>}</>;
}

export function StartCollectionForm({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(startCollection, initial);
  return <form action={action} className="rounded-xl border bg-card p-6">
    <h2 className="font-semibold">공개 영상 가져오기</h2>
    <fieldset disabled={disabled || pending} className="mt-5 space-y-4 disabled:opacity-60">
      <div><label htmlFor="collection-kind" className="text-sm font-medium">수집 방법</label><select id="collection-kind" name="kind" className="mt-2 block h-10 w-full rounded-lg border bg-white px-3 text-sm"><option value="search">키워드로 검색</option><option value="channel_uploads">채널 업로드 목록</option></select></div>
      <div><label htmlFor="collection-query" className="text-sm font-medium">검색어 또는 채널</label><input required id="collection-query" name="query" maxLength={300} placeholder="예: 새벽 기도 또는 @채널핸들" className="mt-2 h-11 w-full rounded-lg border px-3 text-sm" aria-describedby="collection-help" /><p id="collection-help" className="mt-2 text-xs leading-6 text-muted-foreground">키워드는 200자 이내로 입력하세요. 채널은 UC로 시작하는 ID, @핸들 또는 https://www.youtube.com/@핸들 주소를 지원합니다.</p></div>
      <label className="flex items-start gap-2 text-xs leading-6 text-muted-foreground"><input type="checkbox" name="consent" value="yes" required className="mt-1.5" /><span>아래 수집 정보와 보관·삭제 안내를 확인했으며, <a className="text-primary underline" href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube 이용약관</a> 및 <a className="text-primary underline" href="/privacy" target="_blank" rel="noopener noreferrer">개인정보 처리 안내</a>에 동의합니다.</span></label>
      <Button type="submit">{pending ? "가져와서 저장하는 중…" : "첫 50개 가져오기"}</Button>
    </fieldset>
    <Feedback state={state} />
    <p className="mt-4 text-xs leading-6 text-muted-foreground">공개 영상의 제목·설명·썸네일·채널·게시일·자막 표시만 수집합니다. 영상 파일이나 자막 원문은 다운로드하지 않습니다. 저장 성공 후에만 다음 페이지로 이동합니다.</p>
  </form>;
}

export function ContinueCollectionForm({ jobId, label, disabled }: { jobId: string; label: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(continueCollection, initial);
  return <form action={action} className="mt-4"><input type="hidden" name="jobId" value={jobId} /><Button type="submit" variant="outline" disabled={disabled || pending}>{pending ? "가져와서 저장하는 중…" : label}</Button><Feedback state={state} /></form>;
}
