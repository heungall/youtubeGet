import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <div className="py-20 text-center"><p className="text-xs font-semibold text-primary">404</p><h1 className="mt-3 text-2xl font-semibold">페이지를 찾을 수 없습니다.</h1><Button asChild className="mt-6"><Link href="/">대시보드로 이동</Link></Button></div>;
}
