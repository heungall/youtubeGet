import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { getConfigurationStatus } from "@/lib/config";
import { getWorkspaceSession } from "@/lib/auth/session";
import { loadOverview } from "@/lib/archive";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "연동 설정" };
export const dynamic = "force-dynamic";

const labels = { missing: "미설정", invalid: "주소·키 종류 확인 필요", configured: "설정됨 · 연결 미검증" };

export default async function SettingsPage() {
  const status = getConfigurationStatus(process.env);
  const session = await getWorkspaceSession();
  const overview = session.status === "signed_in" ? await loadOverview(session) : null;
  return <>
    <PageHeading eyebrow="WORKSPACE / SETTINGS" title="연동 설정" description="연동 준비 상태를 확인하세요. 키 값은 서버에서 관리하며 화면에 표시하지 않습니다." />
    <section className="overflow-hidden rounded-xl border bg-card">
      {[
        { title: "Supabase", text: "영상과 키워드의 영구 저장 · 사용자별 접근 제어", state: status.supabase },
        { title: "YouTube Data API", text: "공개 영상 검색 · 채널 업로드 목록 수집", state: status.youtube },
      ].map(({ title, text, state }) => <div key={title} className="flex flex-wrap items-center justify-between gap-4 border-b p-6 last:border-0">
        <div><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{text}</p></div>
        <span className={`rounded-md px-3 py-1.5 text-xs ${state === "configured" ? "bg-[#e6eee9] text-primary" : "bg-amber-50 text-amber-800"}`}>{labels[state]}</span>
      </div>)}
    </section>
    <section className="mt-6 rounded-xl border bg-card p-6">
      <h2 className="font-semibold">사용자 세션 및 DB 연결</h2>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{session.status === "setup_required" ? "Supabase 서버 환경변수를 먼저 설정해 주세요." : session.status === "signed_in" ? overview ? "로그인과 DB 조회를 확인했습니다. 본인 소유 영상·채널·캠페인 및 13개 대표 카테고리를 조회할 수 있습니다." : "로그인은 확인했지만 DB 조회에 실패했습니다. SQL 적용과 테이블 접근 권한을 확인해 주세요." : session.status === "unavailable" ? "인증 서버 연결 또는 기존 세션을 확인하지 못했습니다. 다시 로그인하거나 잠시 후 재시도해 주세요." : "아직 로그인하지 않았습니다. 로그인 후 실제 DB 연결 상태를 확인합니다."}</p>
      {session.status !== "signed_in" && <Button asChild variant="outline" className="mt-4"><Link href="/login">로그인</Link></Button>}
    </section>
    <section className="mt-6 rounded-xl border bg-card p-6">
      <h2 className="font-semibold">연결 전 확인 사항</h2>
      <ol className="mt-4 list-inside list-decimal space-y-3 text-sm leading-6 text-muted-foreground">
        <li>서버 환경변수에 Supabase 프로젝트 주소, 공개 키, YouTube API 키를 설정합니다.</li>
        <li>Supabase에 DB 마이그레이션을 적용하고 Google 로그인을 연결합니다.</li>
        <li>수집용 추가 SQL과 보관 기한 정기 작업을 적용한 뒤 YouTube 수집 화면에서 검색·저장을 확인합니다.</li>
      </ol>
      <p className="mt-5 text-xs leading-6 text-muted-foreground">위 환경변수 표시는 값의 존재와 주소 형식만 확인합니다. 실제 DB 상태는 로그인 후 별도로 조회하며, YouTube 연결은 수집 화면에서 요청할 때 확인합니다.</p>
      <Button asChild variant="outline" className="mt-4"><Link href="/collect">YouTube 수집 시작</Link></Button>
    </section>
  </>;
}
