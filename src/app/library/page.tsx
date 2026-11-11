import type { Metadata } from "next";
import Link from "next/link";
import { Library } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "영상 라이브러리" };

export default function LibraryPage() {
  return <>
    <PageHeading eyebrow="WORKSPACE / LIBRARY" title="영상 라이브러리" description="공개 영상의 제목, 채널, 키워드와 서머리를 모아 다시 찾아보세요." />
    <section className="flex min-h-96 flex-col items-center justify-center rounded-2xl border bg-card px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-muted"><Library className="size-6 text-muted-foreground" aria-hidden="true" /></span>
      <h2 className="mt-5 text-lg font-semibold">영상 수집 연동을 준비하고 있습니다.</h2>
      <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">로그인과 수집 API는 다음 개발 단계입니다. 연결 전에는 저장 영상 수나 샘플 영상을 실제 데이터로 표시하지 않습니다.</p>
      <Button asChild variant="outline" className="mt-6"><Link href="/settings">연동 설정 확인</Link></Button>
    </section>
    <p className="mt-5 text-xs leading-6 text-muted-foreground">자막 표시 여부와 자막 원문 확보 여부는 별도로 관리합니다. 메타데이터 기반 서머리는 영상 내용을 확인한 요약과 구분합니다.</p>
  </>;
}
