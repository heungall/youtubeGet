export type CaptionIndicator = "available" | "unavailable" | "unknown";
export type TranscriptStatus = "not_requested" | "available" | "unavailable" | "failed" | "manual";
export type AnalysisStatus = "not_started" | "metadata_only" | "pending" | "transcript_analyzed" | "failed";
export type SummarySource = "metadata" | "transcript" | "manual";
export type KeywordOrigin = "metadata" | "transcript" | "manual";

export const captionLabels: Record<CaptionIndicator, string> = {
  available: "자막 표시 있음",
  unavailable: "자막 표시 없음",
  unknown: "자막 표시 확인 불가",
};

export const summarySourceLabels: Record<SummarySource, string> = {
  metadata: "제목·설명 기반 초안",
  transcript: "제공된 자막 기반",
  manual: "사용자 직접 작성",
};
