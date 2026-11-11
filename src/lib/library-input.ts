import type { CaptionIndicator } from "@/lib/domain";

export const LIBRARY_PAGE_SIZE = 50;
export type LibraryFilters = { query: string; caption: CaptionIndicator | "all"; page: number };

export function readLibraryFilters(params: Record<string, unknown>): LibraryFilters {
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const caption = typeof params.caption === "string" && ["available", "unavailable", "unknown"].includes(params.caption) ? params.caption as CaptionIndicator : "all";
  const page = typeof params.page === "string" && /^[1-9]\d{0,3}$/.test(params.page) ? Number(params.page) : 1;
  return { query, caption, page };
}

export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function libraryPageHref(filters: LibraryFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.caption !== "all") params.set("caption", filters.caption);
  if (page > 1) params.set("page", String(page));
  return `/library${params.size ? `?${params}` : ""}`;
}

export function youtubeThumbnail(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "i.ytimg.com" && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}
