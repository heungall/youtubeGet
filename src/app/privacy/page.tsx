import { PageHeading } from "@/components/page-heading";

export const metadata = { title: "개인정보 처리 안내" };
export default function PrivacyPage() {
  return <><PageHeading eyebrow="WORKSPACE / PRIVACY" title="개인정보 처리 안내" description="YouTube Keyword Archive 내부 도구 · 적용일 2026-11-11" /><section className="space-y-5 rounded-xl border bg-card p-6 text-sm leading-7 text-muted-foreground">
    <p>이 도구는 Google 로그인을 통한 사용자 식별 정보(사용자 ID·이메일)와 세션 쿠키를 사용합니다. 앱에서 Google 비밀번호를 입력받지 않습니다. Supabase는 인증·DB 저장, Vercel은 앱 실행을 처리하며 사용자별 데이터는 접근 정책으로 분리합니다.</p>
    <p>YouTube API Services로 공개 영상의 ID·제목·설명·썸네일 주소·게시일·자막 표시, 공개 채널 정보와 페이지 커서를 가져옵니다. 입력한 검색어·채널 및 공개 영상 ID를 Google에 전송합니다. 썸네일을 표시하면 브라우저가 YouTube 이미지 서버에 접속합니다. 영상 파일과 자막 원문을 자동 다운로드하지 않습니다. 현재 외부 AI에 데이터를 전송하지 않습니다.</p>
    <p>메타데이터는 사용자 아카이브 조회를 위해 저장합니다. 다시 수집하면 갱신하고, 갱신되지 않은 메타데이터는 29일 기한 후 매시간 삭제합니다. 관련 분류·자막·분석·선정 연결도 삭제됩니다. 수집 작업 기록도 29일 후 정리합니다. 세션 쿠키는 로그인 유지에 사용하며 로그아웃 시 현재 세션을 해제합니다.</p>
    <p>저장 데이터나 계정 삭제는 이 내부 도구를 제공한 운영 담당자에게 요청하세요. 담당자는 Supabase에서 해당 사용자 데이터를 삭제하며, 요청 후 최대 7일 이내 처리해야 합니다. 이 앱의 데이터 삭제는 YouTube의 원본 영상·계정에 영향을 주지 않습니다. Google 로그인 연결은 Google 계정 보안 설정에서도 해제할 수 있습니다.</p>
    <p>이 도구를 사용하면 <a className="text-primary underline" href="https://www.youtube.com/t/terms">YouTube 이용약관</a>에 동의하게 됩니다. <a className="text-primary underline" href="https://policies.google.com/privacy">Google 개인정보처리방침</a> 및 <a className="text-primary underline" href="https://myaccount.google.com/permissions">Google 계정 연결 관리</a>를 확인할 수 있습니다.</p>
  </section></>;
}
