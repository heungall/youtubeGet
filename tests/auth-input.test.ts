import { describe, expect, it } from "vitest";
import { safeReturnTo } from "@/lib/auth/input";
import { appOrigin, googleCallbackUrl, validGoogleAuthorizeUrl } from "@/lib/auth/oauth";
import { escapeLike, libraryPageHref, readLibraryFilters, youtubeThumbnail } from "@/lib/library-input";

describe("인증 입력과 복귀 주소", () => {
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "/%5cevil.example", "/%0d%0aLocation:evil", "/login?next=/login", "/unknown", "/%zz", undefined, ["/library"]])("외부 이동과 잘못된 주소를 거부한다: %s", (input) => {
    expect(safeReturnTo(input)).toBe("/");
  });
  it("허용된 화면의 검색 조건을 유지한다", () => {
    expect(safeReturnTo("/library?q=%EA%B8%B0%EB%8F%84&page=2")).toBe("/library?q=%EA%B8%B0%EB%8F%84&page=2");
    expect(safeReturnTo("/library?q=prayer%20time")).toBe("/library?q=prayer%20time");
  });
  it("명시한 배포 주소를 사용하고 운영에서 localhost를 기본값으로 만들지 않는다", () => {
    expect(appOrigin({ APP_URL: "https://archive.example" }, "https://preview.example")).toBe("https://archive.example");
    expect(appOrigin({}, "https://archive.example")).toBe("https://archive.example");
    expect(() => appOrigin({ NODE_ENV: "production" })).toThrow();
    expect(appOrigin({ NODE_ENV: "development" })).toBe("http://localhost:3000");
  });
  it.each(["http://example.com", "https://user:secret@example.com", "https://example.com/path", "https://example.com/?key=x", "javascript:alert(1)"])("잘못된 고정 사이트 주소를 거부한다: %s", (value) => {
    expect(() => appOrigin({ APP_URL: value })).toThrow();
  });
  it("OAuth 콜백은 쿼리 없이 고정된 주소를 사용한다", () => {
    const url = new URL(googleCallbackUrl("https://archive.example"));
    expect(url.origin).toBe("https://archive.example");
    expect(url.pathname).toBe("/auth/callback");
    expect(url.search).toBe("");
  });
  it("Supabase의 Google 인가 주소만 허용한다", () => {
    const project = "https://project.supabase.co";
    expect(validGoogleAuthorizeUrl(`${project}/auth/v1/authorize?provider=google`, project)).toBe(true);
    for (const url of [null, "https://evil.example/auth/v1/authorize?provider=google", `${project}/auth/v1/authorize?provider=github`, `${project}/other?provider=google`, `https://user:secret@project.supabase.co/auth/v1/authorize?provider=google`]) expect(validGoogleAuthorizeUrl(url, project)).toBe(false);
  });
});

describe("라이브러리 조회 입력", () => {
  it("과도한 입력과 배열형 쿼리를 제한한다", () => {
    expect(readLibraryFilters({ q: "a".repeat(1000), page: "-1", caption: ["available"] })).toEqual({ query: "a".repeat(100), page: 1, caption: "all" });
    expect(readLibraryFilters({ page: "9999999" }).page).toBe(1);
  });
  it("페이지 링크에서 검색 조건을 인코딩한다", () => {
    const filters = readLibraryFilters({ q: " 기도 & 말씀 ", caption: "available", page: "2" });
    const url = new URL(libraryPageHref(filters, 3), "https://archive.invalid");
    expect(url.searchParams.get("q")).toBe("기도 & 말씀");
    expect(url.searchParams.get("page")).toBe("3");
    expect(url.searchParams.get("caption")).toBe("available");
  });
  it("LIKE 와일드카드를 검색 문자로 처리한다", () => {
    expect(escapeLike("10%_\\기도")).toBe("10\\%\\_\\\\기도");
  });
  it("YouTube 썸네일 외의 주소를 브라우저에 전달하지 않는다", () => {
    expect(youtubeThumbnail("https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg")).toBeTruthy();
    for (const url of ["https://evil.example/a.jpg", "javascript:alert(1)", "https://i.ytimg.com.evil.example/a.jpg", "https://user:secret@i.ytimg.com/a.jpg", null]) expect(youtubeThumbnail(url)).toBeNull();
  });
});
