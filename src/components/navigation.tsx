"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Download, LayoutDashboard, Library, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/collect", label: "YouTube 수집", icon: Download },
  { href: "/library", label: "영상 라이브러리", icon: Library },
  { href: "/keywords", label: "키워드 사전", icon: BookOpen },
  { href: "/settings", label: "연동 설정", icon: Settings2 },
];

export function Navigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="주 메뉴" className="flex gap-1 overflow-x-auto px-4 py-3 md:flex-col md:px-3">
      {links.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}
          className={cn("flex shrink-0 items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors", pathname === href ? "bg-[#e6eee9] font-semibold text-primary" : "text-muted-foreground hover:bg-muted")}>
          <Icon className="size-[18px]" aria-hidden="true" />{label}
        </Link>
      ))}
    </nav>
  );
}
