import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { CATEGORIES } from "@/lib/categories";

export const metadata: Metadata = { title: "키워드 사전" };

export default function KeywordsPage() {
  return <>
    <PageHeading eyebrow="WORKSPACE / KEYWORDS" title="키워드 사전" description="한 영상에 여러 대표 키워드를 부여할 수 있습니다. 디테일 키워드는 영상 편집 기능에서 자유롭게 추가할 예정입니다." />
    <p className="mb-5 text-xs text-muted-foreground">고정 대표 키워드 <strong className="text-primary">13개</strong> · 요구사항 기준 분류 체계</p>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{CATEGORIES.map(({ code, name }) => <article key={code} id={code} className="scroll-mt-6 rounded-xl border bg-card p-6 target:border-primary">
      <span className="font-mono text-xs text-muted-foreground">{code}</span><h2 className="mt-3 font-semibold">{name}</h2>
      <p className="mt-5 border-t pt-3 text-xs text-muted-foreground">관련 영상 조회 · 연동 예정</p>
    </article>)}</div>
  </>;
}
