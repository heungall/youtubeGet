import "server-only";
import type { CaptionIndicator } from "@/lib/domain";
import { parseChannelInput, type CollectionInput } from "./input";

export type YouTubeEndpoint = "search" | "channels" | "playlistItems" | "videos";
export type CollectedChannel = { youtube_channel_id: string; name: string; uploads_playlist_id: string | null };
export type CollectedVideo = {
  youtube_video_id: string; youtube_channel_id: string; title: string; description: string;
  thumbnail_url: string | null; published_at: string; caption_indicator: CaptionIndicator;
};
export type CollectedPage = {
  channels: CollectedChannel[]; videos: CollectedVideo[]; requestedIds: string[];
  nextCursor: string | null; sourceChannelId: string | null;
};

export const youtubeMessages = {
  not_configured: "서버의 YOUTUBE_API_KEY 설정이 필요합니다.",
  quota_exceeded: "YouTube 사용량 한도에 도달했습니다. Google Cloud의 할당량을 확인하고 나중에 재시도해 주세요.",
  rate_limited: "YouTube 요청이 일시적으로 제한되었습니다. 잠시 후 같은 페이지를 재시도해 주세요.",
  invalid_key: "YouTube API 키 또는 API 사용 설정을 확인해 주세요.",
  invalid_cursor: "페이지 정보가 만료되었거나 변경되었습니다. 새 수집을 시작해 주세요. 기존 영상은 중복 저장되지 않습니다.",
  channel_not_found: "공개 채널을 찾지 못했습니다. 채널 ID 또는 @핸들을 확인해 주세요.",
  unavailable: "YouTube에 연결하지 못했습니다. 잠시 후 같은 페이지를 재시도해 주세요.",
  invalid_response: "YouTube 응답을 확인하지 못했습니다. 페이지를 저장하지 않았습니다. 다시 시도해 주세요.",
};
export class YouTubeError extends Error {
  constructor(public readonly code: keyof typeof youtubeMessages) { super(youtubeMessages[code]); }
}
type Json = Record<string, unknown>;
const object = (value: unknown): Json => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
const string = (value: unknown): string => typeof value === "string" ? value : "";
const videoId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{11}$/.test(value);
const channelId = (value: unknown): value is string => typeof value === "string" && /^UC[A-Za-z0-9_-]{22}$/.test(value);
function items(data: Json): Json[] {
  if (!Array.isArray(data.items) || data.items.length > 50) throw new YouTubeError("invalid_response");
  return data.items.map(object);
}
function cursor(data: Json): string | null {
  if (data.nextPageToken === undefined || data.nextPageToken === "") return null;
  if (typeof data.nextPageToken !== "string" || data.nextPageToken.length > 2048 || /[\u0000-\u0020\u007f]/.test(data.nextPageToken)) throw new YouTubeError("invalid_response");
  return data.nextPageToken;
}
function thumbnail(snippet: Json): string | null {
  const thumbnails = object(snippet.thumbnails);
  for (const size of ["medium", "high", "default"]) {
    try {
      const url = new URL(string(object(thumbnails[size]).url));
      if (url.protocol === "https:" && url.hostname === "i.ytimg.com" && !url.username && !url.password && !url.port) return url.toString();
    } catch { /* 다른 크기의 썸네일을 확인합니다. */ }
  }
  return null;
}

export class YouTubeClient {
  constructor(
    private readonly key: string,
    private readonly beforeRequest: (endpoint: YouTubeEndpoint) => Promise<void> = async () => {},
    private readonly transport: typeof fetch = fetch,
  ) {}

  private async request(endpoint: YouTubeEndpoint, params: Record<string, string>): Promise<Json> {
    if (!this.key.trim()) throw new YouTubeError("not_configured");
    const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
    Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));
    await this.beforeRequest(endpoint);
    let response: Response;
    let data: Json;
    try {
      response = await this.transport(url, {
        headers: { "X-Goog-Api-Key": this.key, Accept: "application/json" },
        cache: "no-store", signal: AbortSignal.timeout(8000), redirect: "error",
      });
      data = object(await response.json());
    } catch { throw new YouTubeError("unavailable"); }
    if (!response.ok) {
      const apiError = object(data.error);
      const reasons = Array.isArray(apiError.errors) ? apiError.errors.map((entry) => string(object(entry).reason)) : [];
      if (Array.isArray(apiError.details)) reasons.push(...apiError.details.map((entry) => string(object(entry).reason)));
      if (reasons.some((reason) => ["quotaExceeded", "dailyLimitExceeded", "dailyLimitExceededUnreg"].includes(reason))) throw new YouTubeError("quota_exceeded");
      if (response.status === 429 || reasons.some((reason) => ["rateLimitExceeded", "userRateLimitExceeded"].includes(reason))) throw new YouTubeError("rate_limited");
      if (reasons.includes("invalidPageToken")) throw new YouTubeError("invalid_cursor");
      if (reasons.some((reason) => ["keyInvalid", "accessNotConfigured", "ipRefererBlocked", "forbidden", "API_KEY_INVALID", "API_KEY_SERVICE_BLOCKED", "SERVICE_DISABLED", "API_KEY_HTTP_REFERRER_BLOCKED", "API_KEY_IP_ADDRESS_BLOCKED"].includes(reason)) || [401, 403].includes(response.status)) throw new YouTubeError("invalid_key");
      if (response.status === 404) throw new YouTubeError("channel_not_found");
      throw new YouTubeError("unavailable");
    }
    return data;
  }

  private readChannels(data: Json): CollectedChannel[] {
    return items(data).map((item) => {
      const snippet = object(item.snippet);
      if (!channelId(item.id) || !string(snippet.title)) throw new YouTubeError("invalid_response");
      const playlist = string(object(object(item.contentDetails).relatedPlaylists).uploads);
      return { youtube_channel_id: item.id, name: string(snippet.title), uploads_playlist_id: /^[A-Za-z0-9_-]{1,100}$/.test(playlist) ? playlist : null };
    });
  }

  async collect(input: CollectionInput, pageToken: string | null): Promise<CollectedPage> {
    let sourceChannel: CollectedChannel | undefined;
    let data: Json;
    const pagination: Record<string, string> = pageToken ? { pageToken } : {};
    if (input.kind === "channel_uploads") {
      const selector = parseChannelInput(input.query);
      if (!selector) throw new YouTubeError("channel_not_found");
      sourceChannel = this.readChannels(await this.request("channels", { part: "snippet,contentDetails", ...selector }))[0];
      if (!sourceChannel?.uploads_playlist_id) throw new YouTubeError("channel_not_found");
      data = await this.request("playlistItems", { part: "contentDetails", playlistId: sourceChannel.uploads_playlist_id, maxResults: "50", ...pagination });
    } else {
      data = await this.request("search", { part: "snippet", type: "video", q: input.query, maxResults: "50", order: "relevance", ...pagination });
    }
    const nextCursor = cursor(data);
    if (nextCursor && nextCursor === pageToken) throw new YouTubeError("invalid_response");
    const requestedIds = [...new Set(items(data).map((item) => input.kind === "search" ? object(item.id).videoId : object(item.contentDetails).videoId).map((id) => {
      if (!videoId(id)) throw new YouTubeError("invalid_response");
      return id;
    }))];
    const videos: CollectedVideo[] = [];
    if (requestedIds.length) {
      const details = await this.request("videos", { part: "snippet,contentDetails,status", id: requestedIds.join(",") });
      const seen = new Set<string>();
      for (const item of items(details)) {
        if (!videoId(item.id) || !requestedIds.includes(item.id) || seen.has(item.id)) throw new YouTubeError("invalid_response");
        seen.add(item.id);
        const privacy = object(item.status).privacyStatus;
        if (!["public", "private", "unlisted"].includes(string(privacy))) throw new YouTubeError("invalid_response");
        if (privacy !== "public") continue;
        const snippet = object(item.snippet);
        const published = string(snippet.publishedAt);
        if (!channelId(snippet.channelId) || !string(snippet.title) || !published || !Number.isFinite(Date.parse(published))) throw new YouTubeError("invalid_response");
        const caption = object(item.contentDetails).caption;
        videos.push({ youtube_video_id: item.id, youtube_channel_id: snippet.channelId, title: string(snippet.title), description: string(snippet.description),
          thumbnail_url: thumbnail(snippet), published_at: new Date(published).toISOString(), caption_indicator: caption === "true" ? "available" : caption === "false" ? "unavailable" : "unknown" });
      }
    }
    const channelIds = [...new Set(videos.map((video) => video.youtube_channel_id))];
    const missingChannels = channelIds.filter((id) => id !== sourceChannel?.youtube_channel_id);
    const channels = sourceChannel ? [sourceChannel] : [];
    if (missingChannels.length) channels.push(...this.readChannels(await this.request("channels", { part: "snippet,contentDetails", id: missingChannels.join(",") })));
    if (channelIds.some((id) => !channels.some((channel) => channel.youtube_channel_id === id))) throw new YouTubeError("invalid_response");
    return { channels, videos, requestedIds, nextCursor, sourceChannelId: sourceChannel?.youtube_channel_id ?? null };
  }
}
