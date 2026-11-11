export const CATEGORIES = [
  { code: "K01", name: "기도" },
  { code: "K02", name: "말씀/성경읽기" },
  { code: "K03", name: "내면/신앙" },
  { code: "K04", name: "교회/공동체" },
  { code: "K05", name: "사이비/이단" },
  { code: "K06", name: "연애/결혼/가정" },
  { code: "K07", name: "인간관계/소통" },
  { code: "K08", name: "일/진로" },
  { code: "K09", name: "돈/재정" },
  { code: "K10", name: "질병치료" },
  { code: "K11", name: "새신자반" },
  { code: "K12", name: "세계관" },
  { code: "K13", name: "예배" },
] as const;

export type CategoryCode = (typeof CATEGORIES)[number]["code"];
