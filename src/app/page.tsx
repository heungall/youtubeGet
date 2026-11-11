import Link from "next/link";
import { ArrowRight, BookOpen, Check, Database, FolderSearch, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { CATEGORIES } from "@/lib/categories";
import { getWorkspaceSession, requireWorkspaceSession } from "@/lib/auth/session";
import { loadOverview } from "@/lib/archive";

export default async function Home() {
  const state = await getWorkspaceSession();
  const session = state.status === "setup_required" ? null : await requireWorkspaceSession("/");
  const overview = session ? await loadOverview(session) : null;
  return <>
    <PageHeading eyebrow="WORKSPACE / OVERVIEW" title="콘텐츠를 모으고, 다음 기획으로 연결하세요."
      description="공개 유튜브 영상에서 키워드를 찾고 월별 콘텐츠를 선정하는 공간입니다. 저장된 콘텐츠는 사용자별로 관리합니다."
      action={<Button asChild variant="outline"><Link href="/settings"><Settings2 />연동 설정 확인</Link></Button>} />
    {session && (overview ? <section aria-label="저장 현황" className="mb-6 grid gap-4 sm:grid-cols-3">{[
      { label: "저장 영상", count: overview.videos }, { label: "등록 채널", count: overview.channels }, { label: "월별 캠페인", count: overview.campaigns },
    ].map(({ label, count }) => <div key={label} className="rounded-xl border bg-card p-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-3 text-3xl font-semibold">{count.toLocaleString("ko-KR")}<span className="ml-1 text-sm font-normal text-muted-foreground">개</span></p></div>)}</section>
      : <p role="alert" className="mb-6 rounded-xl border bg-amber-50 p-5 text-sm text-amber-900">DB 조회에 실패했습니다. 연동 설정에서 연결 상태를 확인하고 다시 시도해 주세요.</p>)}
    <section className="mb-8 overflow-hidden rounded-2xl border bg-card">
      <div className="grid md:grid-cols-[1.4fr_1fr]">
        <div className="p-7 md:p-9">
          <span className="rounded-md bg-[#edf3ef] px-2.5 py-1 text-xs font-medium text-primary">아카이브 시작하기</span>
          <h2 className="mt-5 text-xl font-semibold">{overview ? "개인 아카이브가 연결되었습니다." : "첫 번째 영상이 들어올 자리를 준비했습니다."}</h2>
          <p className="mt-3 max-w-lg text-sm leading-7 text-muted-foreground">{overview ? "키워드 검색이나 채널 업로드 목록에서 공개 영상을 가져와 보세요. 한 번에 최대 50개씩 저장하고 다음 페이지를 이어서 수집할 수 있습니다." : "Supabase 연결 설정을 마치고 Google 계정으로 로그인하세요. 로그인 후 실제 저장 현황을 확인할 수 있습니다."}</p>
          <Button asChild className="mt-6"><Link href="/collect">YouTube 영상 가져오기<ArrowRight /></Link></Button>
        </div>
        <ol className="space-y-5 border-t bg-[#fafbf9] p-7 md:border-t-0 md:border-l md:p-9">
          {[
            { title: "워크스페이스 기본 구성", text: "화면 구조와 13개 대표 키워드", ready: true },
            { title: "데이터 연결", text: overview ? "로그인 및 DB 조회 확인됨" : "Supabase 설정 후 로그인", ready: !!overview },
            { title: "공개 영상 수집", text: "채널 또는 키워드 검색 · 수집 화면에서 시작", ready: false },
          ].map((step, i) => <li key={step.title} className="flex items-start gap-3">
            <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${step.ready ? "bg-primary text-white" : "border bg-white text-muted-foreground"}`}>{step.ready ? <Check className="size-3.5" aria-label="구성됨" /> : i + 1}</span>
            <div><p className="text-sm font-medium">{step.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{step.text}</p></div>
          </li>)}
        </ol>
      </div>
    </section>
    <div className="mb-8 grid gap-4 sm:grid-cols-3">
      {[
        { icon: FolderSearch, title: "영상 라이브러리", text: "수집한 영상을 한곳에서 검색", href: "/library" },
        { icon: BookOpen, title: "키워드 사전", text: "13개 대표 키워드를 기준으로 분류", href: "/keywords" },
        { icon: Database, title: "연동 설정", text: "데이터 저장소와 API 설정 확인", href: "/settings" },
      ].map(({ icon: Icon, title, text, href }) => <Link key={href} href={href} className="group rounded-xl border bg-card p-5 transition-colors hover:border-primary/40">
        <div className="flex items-center justify-between"><Icon className="size-5 text-primary" aria-hidden="true" /><ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden="true" /></div>
        <h2 className="mt-5 text-sm font-semibold">{title}</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p>
      </Link>)}
    </div>
    <section className="rounded-xl border bg-card p-6">
      <div className="mb-5 flex items-center justify-between"><h2 className="font-semibold">대표 키워드</h2><Link className="text-xs font-medium text-primary hover:underline" href="/keywords">사전 보기 →</Link></div>
      <div className="flex flex-wrap gap-2">{CATEGORIES.map((category) => <Link key={category.code} href={`/keywords#${category.code}`} className="rounded-lg border px-3 py-2 text-xs text-muted-foreground hover:bg-muted">{category.name}</Link>)}</div>
    </section>
  </>;
}
