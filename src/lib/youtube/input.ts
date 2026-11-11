export type CollectionInput = { kind: "search" | "channel_uploads"; query: string };

export function parseChannelInput(value: string): { id: string } | { forHandle: string } | null {
  let text = value.trim();
  if (text.length > 300) return null;
  if (text.startsWith("https://")) {
    try {
      const url = new URL(text);
      if (!["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname) || url.port || url.username || url.password) return null;
      text = decodeURIComponent(url.pathname).replace(/\/$/, "");
      if (text.startsWith("/channel/")) text = text.slice(9);
      else if (text.startsWith("/@")) text = text.slice(1);
      else return null;
    } catch { return null; }
  }
  if (/^UC[A-Za-z0-9_-]{22}$/.test(text)) return { id: text };
  if (/^@[^\s/?#\\\u0000-\u001f\u007f]{1,100}$/u.test(text)) return { forHandle: text };
  return null;
}

export function readCollectionInput(form: FormData): CollectionInput | null {
  const kind = form.get("kind");
  const raw = form.get("query");
  if (typeof raw !== "string" || !["search", "channel_uploads"].includes(String(kind))) return null;
  const query = raw.trim();
  if (!query || query.length > (kind === "search" ? 200 : 300) || /[\u0000-\u001f\u007f]/.test(query)) return null;
  if (kind === "channel_uploads" && !parseChannelInput(query)) return null;
  return { kind: kind as CollectionInput["kind"], query };
}

export const validJobId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
