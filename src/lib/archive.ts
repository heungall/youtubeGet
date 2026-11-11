import "server-only";
import type { WorkspaceSession } from "@/lib/auth/session";
import type { CaptionIndicator, TranscriptStatus } from "@/lib/domain";
import { escapeLike, LIBRARY_PAGE_SIZE, type LibraryFilters } from "@/lib/library-input";

type SignedInSession = Extract<WorkspaceSession, { status: "signed_in" }>;

/** 기존 마이그레이션에 대응하는 조회 결과 타입입니다. 원격 DB 생성 타입은 아닙니다. */
export type LibraryVideo = {
  id: string;
  youtube_video_id: string;
  title: string;
  thumbnail_url: string | null;
  published_at: string | null;
  caption_indicator: CaptionIndicator;
  transcript_status: TranscriptStatus;
  channel: { name: string } | null;
};

export async function loadOverview(session: SignedInSession) {
  try {
    const counts = await Promise.all([
      session.client.from("videos").select("id", { count: "exact", head: true }).eq("owner_id", session.user.id),
      session.client.from("channels").select("id", { count: "exact", head: true }).eq("owner_id", session.user.id),
      session.client.from("campaigns").select("id", { count: "exact", head: true }).eq("owner_id", session.user.id),
      session.client.from("categories").select("id", { count: "exact", head: true }),
    ]);
    if (counts.some((result) => result.error || result.count === null) || counts[3].count !== 13) return null;
    return { videos: counts[0].count!, channels: counts[1].count!, campaigns: counts[2].count!, categories: counts[3].count! };
  } catch { return null; }
}

export async function loadLibrary(session: SignedInSession, filters: LibraryFilters) {
  try {
    let query = session.client.from("videos")
      .select("id,youtube_video_id,title,thumbnail_url,published_at,caption_indicator,transcript_status,channel:channels(name)", { count: "exact" })
      .eq("owner_id", session.user.id)
      .eq("availability", "public")
      .gt("refresh_due_at", new Date().toISOString());
    if (filters.query) query = query.ilike("title", `%${escapeLike(filters.query)}%`);
    if (filters.caption !== "all") query = query.eq("caption_indicator", filters.caption);
    const first = (filters.page - 1) * LIBRARY_PAGE_SIZE;
    const { data, error, count } = await query.order("published_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true }).range(first, first + LIBRARY_PAGE_SIZE - 1).returns<LibraryVideo[]>();
    if (error || data === null || count === null) return null;
    return { videos: data, count };
  } catch { return null; }
}
