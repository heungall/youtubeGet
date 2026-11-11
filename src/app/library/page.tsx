import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Library } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { getWorkspaceSession, requireWorkspaceSession } from "@/lib/auth/session";
import { loadLibrary } from "@/lib/archive";
import { captionLabels } from "@/lib/domain";
import { LIBRARY_PAGE_SIZE, libraryPageHref, readLibraryFilters, youtubeThumbnail } from "@/lib/library-input";

export const metadata: Metadata = { title: "영상 라이브러리" };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = readLibraryFilters(await searchParams);
  const state = await getWorkspaceSession();
  const session = state.status === "setup_required" ? null : await requireWorkspaceSession(libraryPageHref(filters, filters.page));
  const result = session ? await loadLibrary(session, filters) : null;
  return <>
    <PageHeading eyebrow="WORKSPACE / LIBRARY" title="영상 라이브러리" description="저장된 공개 영상을 제목과 자막 표시 상태로 찾아보세요. 사용자 본인의 영상만 조회합니다." />
    {session && <form action="/library" method="get" className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
      <div className="min-w-40 flex-1"><label htmlFor="video-query" className="text-xs font-medium">영상 제목</label><input id="video-query" name="q" defaultValue={filters.query} maxLength={100} placeholder="검색어를 입력하세요" className="mt-2 h-10 w-full rounded-lg border px-3 text-sm" /></div>
      <div><label htmlFor="caption" className="text-xs font-medium">자막 표시</label><select id="caption" name="caption" defaultValue={filters.caption} className="mt-2 block h-10 rounded-lg border bg-white px-3 text-sm"><option value="all">전체</option><option value="available">표시 있음</option><option value="unavailable">표시 없음</option><option value="unknown">확인 불가</option></select></div>
      <Button type="submit">검색</Button><Button asChild variant="outline"><Link href="/library">초기화</Link></Button>
    </form>}
    {!session ? <section className="rounded-xl border bg-card px-6 py-16 text-center"><h2 className="text-lg font-semibold">Supabase 연결 설정이 필요합니다.</h2><p className="mt-3 text-sm text-muted-foreground">연결 설정을 마치고 로그인하면 저장된 영상을 조회할 수 있습니다.</p><Button asChild className="mt-6" variant="outline"><Link href="/settings">연동 설정 확인</Link></Button></section>
      : !result ? <section role="alert" className="rounded-xl border bg-card p-8"><h2 className="font-semibold">영상 목록을 불러오지 못했습니다.</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">연결 상태와 DB 구성을 확인한 뒤 다시 시도해 주세요. 저장된 데이터는 변경하지 않았습니다.</p><Button asChild className="mt-5" variant="outline"><Link href="/settings">연결 상태 확인</Link></Button></section>
      : <>
        <p className="mb-4 text-xs text-muted-foreground">검색 결과 {result.count.toLocaleString("ko-KR")}개 · {filters.page}페이지 · 페이지당 최대 {LIBRARY_PAGE_SIZE}개</p>
        {result.videos.length === 0 ? <section className="flex min-h-72 flex-col items-center justify-center rounded-xl border bg-card px-6 py-12 text-center"><Library className="size-8 text-muted-foreground" aria-hidden="true" /><h2 className="mt-5 text-lg font-semibold">표시할 영상이 없습니다.</h2><p className="mt-3 max-w-lg text-sm leading-7 text-muted-foreground">검색 조건에 맞는 최신 공개 영상이 없습니다. YouTube 영상 수집은 다음 개발 단계에서 연결합니다.</p></section>
          : <div className="divide-y overflow-hidden rounded-xl border bg-card">{result.videos.map((video) => {
            const thumbnail = youtubeThumbnail(video.thumbnail_url);
            return <article key={video.id} className="flex flex-col gap-4 p-5 sm:flex-row">
              {thumbnail && <Image src={thumbnail} width={160} height={90} unoptimized alt="" className="aspect-video w-40 shrink-0 rounded-lg object-cover" />}
              <div className="min-w-0"><a href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.youtube_video_id)}`} target="_blank" rel="noopener noreferrer" className="font-semibold leading-7 hover:text-primary hover:underline">{video.title}<span className="sr-only"> (YouTube, 새 창)</span></a>
                <p className="mt-1 text-xs text-muted-foreground">{video.channel?.name ?? "채널 정보 없음"}{video.published_at ? ` · ${new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul" }).format(new Date(video.published_at))}` : ""}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-md bg-muted px-2 py-1">{captionLabels[video.caption_indicator]}</span><span className="rounded-md border px-2 py-1">{["available", "manual"].includes(video.transcript_status) ? "자막 원문 확보됨" : "자막 원문 미확보"}</span></div>
              </div>
            </article>;
          })}</div>}
        <nav aria-label="영상 목록 페이지" className="mt-5 flex justify-between gap-3">
          {filters.page > 1 ? <Button asChild variant="outline"><Link href={libraryPageHref(filters, filters.page - 1)}>이전 페이지</Link></Button> : <span />}
          {filters.page * LIBRARY_PAGE_SIZE < result.count && <Button asChild variant="outline"><Link href={libraryPageHref(filters, filters.page + 1)}>다음 페이지</Link></Button>}
        </nav>
      </>}
    <p className="mt-5 text-xs leading-6 text-muted-foreground">자막 표시 여부는 원문 확보를 보장하지 않습니다. 갱신 기한이 지난 영상과 공개 여부를 확인할 수 없는 영상은 이 목록에서 제외합니다.</p>
  </>;
}
