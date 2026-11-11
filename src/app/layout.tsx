import type { Metadata } from "next";
import Link from "next/link";
import { Layers3 } from "lucide-react";
import { Navigation } from "@/components/navigation";
import { getWorkspaceSession } from "@/lib/auth/session";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "콘텐츠 아카이브", template: "%s · 콘텐츠 아카이브" },
  description: "공개 유튜브 영상을 키워드로 정리하는 내부 콘텐츠 아카이브",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getWorkspaceSession();
  return <html lang="ko"><body className="font-sans antialiased">
    <a href="#main-content" className="sr-only fixed z-50 rounded bg-primary p-3 text-white focus:not-sr-only">본문으로 이동</a>
    <div className="min-h-screen md:grid md:grid-cols-[230px_1fr]">
      <aside className="border-b bg-card md:sticky md:top-0 md:flex md:h-screen md:flex-col md:border-r md:border-b-0">
        <Link href="/" className="flex items-center gap-3 px-6 pt-7 pb-5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-white"><Layers3 className="size-5" aria-hidden="true" /></span>
          <span><span className="block text-sm font-bold">콘텐츠 아카이브</span><span className="mt-0.5 block text-[10px] tracking-widest text-muted-foreground">YOUTUBE KEYWORD ARCHIVE</span></span>
        </Link>
        <Navigation />
        <div className="mx-5 mt-auto hidden border-t py-5 text-xs leading-5 text-muted-foreground md:block">
          <span className="mb-2 inline-flex items-center gap-2 font-medium"><span className={`size-1.5 rounded-full ${session.status === "signed_in" ? "bg-primary" : "bg-amber-500"}`} />{session.status === "signed_in" ? "개인 워크스페이스" : "로그인 준비"}</span>
          <p>공개 영상의 메타데이터를 정리하고<br />검토한 콘텐츠를 다시 찾아보세요.</p>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b bg-card px-6 py-2 text-xs text-muted-foreground md:px-10">
          <span>내부 콘텐츠 워크스페이스</span>
          {session.status === "signed_in" ? <div className="flex min-w-0 items-center gap-3"><span className="max-w-40 truncate sm:max-w-64">{session.user.email}</span><form action={logout}><Button type="submit" variant="outline" size="sm">로그아웃</Button></form></div>
            : <Button asChild variant="outline" size="sm"><Link href="/login">로그인</Link></Button>}
        </div>
        <main id="main-content" className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-10">{children}</main>
        <footer className="flex flex-wrap gap-4 px-5 pb-6 text-xs text-muted-foreground md:px-10"><Link href="/privacy" className="hover:underline">개인정보 처리 안내</Link><a href="https://www.youtube.com/t/terms" className="hover:underline">YouTube 이용약관</a></footer>
      </div>
    </div>
  </body></html>;
}
