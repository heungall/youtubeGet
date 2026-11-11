import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { getConfigurationStatus } from "@/lib/config";

export const metadata: Metadata = { title: "연동 설정" };
export const dynamic = "force-dynamic";

const labels = { missing: "미설정", invalid: "주소 확인 필요", configured: "설정됨 · 연결 미검증" };

export default function SettingsPage() {
  const status = getConfigurationStatus(process.env);
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
      <h2 className="font-semibold">연결 전 확인 사항</h2>
      <ol className="mt-4 list-inside list-decimal space-y-3 text-sm leading-6 text-muted-foreground">
        <li>서버 환경변수에 Supabase 프로젝트 주소, 공개 키, YouTube API 키를 설정합니다.</li>
        <li>Supabase에 DB 마이그레이션을 적용하고 사용자 로그인을 연결합니다.</li>
        <li>연동 구현 후 실제 검색·저장·재접속과 접근 권한을 검증합니다.</li>
      </ol>
      <p className="mt-5 text-xs leading-6 text-muted-foreground">현재 표시는 환경변수 유무와 주소 형식만 확인합니다. 외부 API 연결 확인이나 로그인 기능은 아직 구현하지 않았습니다.</p>
    </section>
  </>;
}
