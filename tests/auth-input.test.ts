import { describe, expect, it } from "vitest";
import { readLoginInput, safeReturnTo } from "@/lib/auth/input";
import { escapeLike, libraryPageHref, readLibraryFilters, youtubeThumbnail } from "@/lib/library-input";

describe("인증 입력과 복귀 주소", () => {
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "/%5cevil.example", "/%0d%0aLocation:evil", "/login?next=/login", "/unknown", "/%zz", undefined, ["/library"]])("외부 이동과 잘못된 주소를 거부한다: %s", (input) => {
    expect(safeReturnTo(input)).toBe("/");
  });
  it("허용된 화면의 검색 조건을 유지한다", () => {
    expect(safeReturnTo("/library?q=%EA%B8%B0%EB%8F%84&page=2")).toBe("/library?q=%EA%B8%B0%EB%8F%84&page=2");
    expect(safeReturnTo("/library?q=prayer%20time")).toBe("/library?q=prayer%20time");
  });
  it("이메일만 trim하고 비밀번호의 공백을 보존한다", () => {
    const form = new FormData();
    form.set("email", " user@example.com ");
    form.set("password", " password with space ");
    expect(readLoginInput(form)).toEqual({ email: "user@example.com", password: " password with space " });
  });
  it.each(["", "not-email", "a@", "a b@example.com"])("잘못된 이메일을 거부한다: %s", (email) => {
    const form = new FormData(); form.set("email", email); form.set("password", "password");
    expect(readLoginInput(form)).toBeNull();
  });
  it("누락·빈 비밀번호와 파일 입력을 거부한다", () => {
    const form = new FormData(); form.set("email", "user@example.com");
    expect(readLoginInput(form)).toBeNull();
    form.set("password", ""); expect(readLoginInput(form)).toBeNull();
    form.set("password", new Blob(["not-password"])); expect(readLoginInput(form)).toBeNull();
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
