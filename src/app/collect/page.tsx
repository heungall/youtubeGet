import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { getWorkspaceSession, requireWorkspaceSession } from "@/lib/auth/session";
import { loadCollection } from "@/lib/youtube/collection";
import { youtubeMessages } from "@/lib/youtube/client";
import { StartCollectionForm, ContinueCollectionForm } from "./forms";

export const metadata: Metadata = { title: "YouTube 영상 수집" };
export const maxDuration = 60;
const statusLabels = { pending: "시작 대기", running: "수집 중", paused: "다음 페이지 대기", completed: "수집 완료", failed: "재시도 필요" };

export default async function CollectPage() {
  const state = await getWorkspaceSession();
  const session = state.status === "setup_required" ? null : await requireWorkspaceSession("/collect");
  const collection = session ? await loadCollection(session).catch(() => null) : null;
  const configured = !!process.env.YOUTUBE_API_KEY?.trim();
  const ready = !!session && configured && !!collection?.maintenanceReady;
  return <>
    <PageHeading eyebrow="WORKSPACE / COLLECT" title="YouTube 영상 수집" description="키워드로 공개 영상을 검색하거나 채널의 업로드 영상을 50개씩 가져옵니다. 저장 결과는 본인의 라이브러리에서 확인할 수 있습니다." action={<Button asChild variant="outline"><Link href="/library">영상 라이브러리</Link></Button>} />
    {!session ? <p role="status" className="mb-5 rounded-xl border bg-card p-5 text-sm">Supabase 설정 후 로그인해 주세요. <Link href="/settings" className="text-primary underline">연동 설정</Link></p>
      : !collection ? <p role="alert" className="mb-5 rounded-xl border bg-amber-50 p-5 text-sm text-amber-900">수집 DB를 확인하지 못했습니다. 새 수집용 SQL을 적용하고 연결 상태를 확인해 주세요.</p>
      : !collection.maintenanceReady && <p role="alert" className="mb-5 rounded-xl border bg-amber-50 p-5 text-sm text-amber-900">보관 기한 자동 정리 설정이 필요합니다. 수집용 SQL과 maintenance.sql을 적용하면 수집을 시작할 수 있습니다.</p>}
    {!configured && <p role="alert" className="mb-5 rounded-xl border bg-amber-50 p-5 text-sm text-amber-900">YouTube API 키 설정이 필요합니다. Vercel 환경변수 설정 후 새 배포에 반영해 주세요.</p>}
    <StartCollectionForm disabled={!ready} />
    <section className="mt-7"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">최근 수집 내역</h2><Link href="/collect" className="text-xs text-primary underline">상태 새로고침</Link></div>
      {!collection?.jobs.length ? <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">아직 수집 내역이 없습니다.</p> : <div className="space-y-3">{collection.jobs.map((job) => {
        const running = job.status === "running" && !!job.lease_expires_at && new Date(job.lease_expires_at).getTime() > collection.checkedAt;
        const errorMessage = job.error_code && job.error_code in youtubeMessages ? youtubeMessages[job.error_code as keyof typeof youtubeMessages] : "저장 또는 연결을 확인하지 못했습니다. 같은 페이지를 재시도해 주세요.";
        return <article key={job.id} className="rounded-xl border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">{job.job_type === "search" ? "키워드 검색" : "채널 업로드"} · {new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(job.created_at))}</p><h3 className="mt-2 font-medium break-all">{job.query}</h3></div><span className="rounded-md bg-muted px-2.5 py-1 text-xs">{job.status === "running" && !running ? "연결 종료 · 재시도 가능" : statusLabels[job.status]}</span></div>
          <p className="mt-3 text-sm text-muted-foreground">저장·갱신 {job.processed_count}건 · 비공개/삭제 제외 {job.skipped_count}건 · 페이지 시도 {job.attempt_count}회</p><p className="mt-2 text-xs leading-6 text-muted-foreground">요청 추정: 검색 {job.search_request_count}회 / 일반 API {job.general_quota_units}단위</p>
          {job.status === "failed" && <p role="alert" className="mt-3 text-sm leading-6 text-red-700">{errorMessage}</p>}
          {job.status !== "completed" && <ContinueCollectionForm jobId={job.id} label={running ? "현재 페이지 수집 중" : job.status === "paused" ? "다음 50개 가져오기" : "같은 페이지 재시도"} disabled={!ready || running} />}
        </article>;
      })}</div>}
      <p className="mt-4 text-xs leading-6 text-muted-foreground">저장·갱신 건수는 중복 영상의 갱신도 포함합니다. 중복 영상은 라이브러리에 한 번만 저장됩니다. 자동으로 전체 페이지를 가져오지 않으며, 사용량은 Google Cloud에서 최종 확인하세요.</p>
    </section>
    <section className="mt-6 rounded-xl border bg-card p-6"><h2 className="text-sm font-semibold">보관·삭제 안내</h2><p className="mt-3 text-xs leading-6 text-muted-foreground">YouTube API Services를 사용합니다. 공개 메타데이터는 다시 수집하면 갱신되며, 29일 동안 갱신되지 않은 데이터는 매시간 정리합니다. 삭제된 영상과 연결된 분류·자막·분석·선정 연결도 함께 삭제됩니다. 자막 자체의 보관 기한도 적용됩니다. 원본 YouTube 영상에는 영향을 주지 않습니다. <Link className="text-primary underline" href="/privacy">개인정보 처리 및 삭제 방법</Link></p></section>
  </>;
}
