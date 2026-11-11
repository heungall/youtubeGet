import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { YouTubeClient, YouTubeError } from "@/lib/youtube/client";
import { parseChannelInput, readCollectionInput } from "@/lib/youtube/input";

const channel = `UC${"a".repeat(22)}`;
const id = "abcdefghijk";
const channelItem = { id: channel, snippet: { title: "테스트 채널" }, contentDetails: { relatedPlaylists: { uploads: `UU${"a".repeat(22)}` } } };
function details(caption: unknown = "true", privacyStatus = "public") {
  return { id, snippet: { title: "기도 영상", description: "설명", channelId: channel, publishedAt: "2026-11-10T12:00:00Z", thumbnails: { medium: { url: "https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg" } } }, contentDetails: { caption }, status: { privacyStatus } };
}
function response(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status }); }

describe("채널 입력의 외부 주소 제한", () => {
  it.each([channel, `https://www.youtube.com/channel/${channel}`])("채널 ID를 정규화한다: %s", (value) => expect(parseChannelInput(value)).toEqual({ id: channel }));
  it.each(["@한글채널", "https://youtube.com/@%ED%95%9C%EA%B8%80%EC%B1%84%EB%84%90/"])("핸들을 지원한다: %s", (value) => expect(parseChannelInput(value)).toEqual({ forHandle: "@한글채널" }));
  it.each(["https://evil.test/@channel", "https://youtube.com.evil.test/@channel", "https://user:pass@youtube.com/@channel", "https://youtube.com/watch?v=abcdefghijk", "https://youtube.com:444/@channel", "https://youtube.com/c/name", "@name\\path", "http://localhost/"])("지원하지 않는 입력을 거절한다: %s", (value) => expect(parseChannelInput(value)).toBeNull());
  it("검색 입력 길이/종류와 공백을 검증한다", () => {
    const form = new FormData(); form.set("kind", "search"); form.set("query", "  새벽 기도  ");
    expect(readCollectionInput(form)).toEqual({ kind: "search", query: "새벽 기도" });
    form.set("query", "가".repeat(201)); expect(readCollectionInput(form)).toBeNull();
    form.set("query", "a\nb"); expect(readCollectionInput(form)).toBeNull();
    form.set("kind", "refresh"); expect(readCollectionInput(form)).toBeNull();
  });
});

describe("공식 YouTube API 페이지 수집 (HTTP 모의)", () => {
  it("검색→영상 상세→채널을 조회하고 키는 URL에 넣지 않는다", async () => {
    const calls: string[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      expect(url.origin).toBe("https://www.googleapis.com");
      expect(url.searchParams.has("key")).toBe(false);
      expect(init?.headers).toMatchObject({ "X-Goog-Api-Key": "fixture-only" });
      expect(init?.cache).toBe("no-store"); expect(init?.redirect).toBe("error"); expect(init?.signal).toBeInstanceOf(AbortSignal);
      calls.push(url.pathname.split("/").pop()!);
      if (url.pathname.endsWith("search")) {
        expect(url.searchParams.get("maxResults")).toBe("50"); expect(url.searchParams.get("type")).toBe("video"); expect(url.searchParams.get("pageToken")).toBe("previous");
        return response({ items: [{ id: { videoId: id } }, { id: { videoId: id } }], nextPageToken: "next" });
      }
      if (url.pathname.endsWith("videos")) { expect(url.searchParams.get("id")).toBe(id); return response({ items: [details()] }); }
      return response({ items: [channelItem] });
    });
    const recorded: string[] = [];
    const page = await new YouTubeClient("fixture-only", async (endpoint) => { recorded.push(endpoint); }, fetcher).collect({ kind: "search", query: "기도" }, "previous");
    expect(calls).toEqual(["search", "videos", "channels"]); expect(recorded).toEqual(calls);
    expect(page.videos).toHaveLength(1); expect(page.requestedIds).toEqual([id]); expect(page.nextCursor).toBe("next");
    expect(page.videos[0]).toMatchObject({ caption_indicator: "available", youtube_channel_id: channel });
    expect(page.videos[0]).not.toHaveProperty("transcript_status");
  });
  it("채널 핸들→uploads→영상 상세를 조회한다", async () => {
    const requests: URL[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = new URL(String(input)); requests.push(url);
      if (url.pathname.endsWith("channels")) { expect(url.searchParams.get("forHandle")).toBe("@한글채널"); return response({ items: [channelItem] }); }
      if (url.pathname.endsWith("playlistItems")) { expect(url.searchParams.get("playlistId")).toBe(`UU${"a".repeat(22)}`); expect(url.searchParams.get("pageToken")).toBe("page2"); return response({ items: [{ contentDetails: { videoId: id } }] }); }
      return response({ items: [details("false")] });
    });
    const page = await new YouTubeClient("fixture", undefined, fetcher).collect({ kind: "channel_uploads", query: "@한글채널" }, "page2");
    expect(requests).toHaveLength(3); expect(page.sourceChannelId).toBe(channel); expect(page.nextCursor).toBeNull(); expect(page.videos[0].caption_indicator).toBe("unavailable");
  });
  it("빈 검색은 상세 API를 호출하지 않고 종료한다", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ items: [] }));
    const page = await new YouTubeClient("fixture", undefined, fetcher).collect({ kind: "search", query: "없음" }, null);
    expect(page.videos).toEqual([]); expect(page.nextCursor).toBeNull(); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("삭제/비공개 영상은 공개 영상으로 저장하지 않는다", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ items: [{ id: { videoId: id } }, { id: { videoId: "missing1234" } }] })).mockResolvedValueOnce(response({ items: [details("true", "private")] }));
    const page = await new YouTubeClient("fixture", undefined, fetcher).collect({ kind: "search", query: "기도" }, null);
    expect(page.videos).toEqual([]); expect(page.requestedIds).toEqual([id, "missing1234"]); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([[403, "quotaExceeded", "quota_exceeded"], [429, "rateLimitExceeded", "rate_limited"], [400, "keyInvalid", "invalid_key"], [400, "invalidPageToken", "invalid_cursor"], [503, "backendError", "unavailable"]])("상태 %s와 %s 오류를 안전하게 안내한다", async (status, reason, code) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ error: { message: "secret internal URL", errors: [{ reason }] } }, Number(status)));
    const operation = new YouTubeClient("fixture", undefined, fetcher).collect({ kind: "search", query: "기도" }, null);
    await expect(operation).rejects.toMatchObject({ code });
    await operation.catch((error: Error) => expect(error.message).not.toContain("secret"));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("네트워크/타임아웃 원문을 노출하지 않는다", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("secret-key-and-url"));
    await expect(new YouTubeClient("fixture", undefined, fetcher).collect({ kind: "search", query: "기도" }, null)).rejects.toMatchObject({ code: "unavailable" });
  });
  it("공개 상태가 누락된 상세 응답을 삭제된 영상으로 해석하지 않는다", async () => {
    const malformed = { ...details(), status: {} };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ items: [{ id: { videoId: id } }] })).mockResolvedValueOnce(response({ items: [malformed] }));
    await expect(new YouTubeClient("fixture", undefined, fetcher).collect({ kind: "search", query: "기도" }, null)).rejects.toMatchObject({ code: "invalid_response" });
  });
  it("Google 구조화 오류의 API 키 제한도 구분한다", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ error: { errors: [{ reason: "badRequest" }], details: [{ reason: "API_KEY_INVALID" }] } }, 400));
    await expect(new YouTubeClient("fixture", undefined, fetcher).collect({ kind: "search", query: "기도" }, null)).rejects.toMatchObject({ code: "invalid_key" });
  });
  it.each([{ items: null }, { items: [{}] }, { items: [], nextPageToken: "previous" }])("잘못된 응답과 반복 커서를 거절한다: %j", async (data) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(data));
    await expect(new YouTubeClient("fixture", undefined, fetcher).collect({ kind: "search", query: "기도" }, "previous")).rejects.toMatchObject({ code: "invalid_response" });
  });
  it("요청 기록에 실패하면 YouTube API를 호출하지 않는다", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(new YouTubeClient("fixture", async () => { throw new Error("DB failed"); }, fetcher).collect({ kind: "search", query: "기도" }, null)).rejects.toThrow("DB failed");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("미설정 키와 존재하지 않는 채널을 구분한다", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ items: [] }));
    await expect(new YouTubeClient("", undefined, fetcher).collect({ kind: "search", query: "기도" }, null)).rejects.toBeInstanceOf(YouTubeError);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(new YouTubeClient("fixture", undefined, fetcher).collect({ kind: "channel_uploads", query: "@missing" }, null)).rejects.toMatchObject({ code: "channel_not_found" });
  });
});
