/**
 * Central API client for the search engine backend.
 *
 * Query string format expected by `POST /api/search`:
 *   `<qualifier>=<value> <qualifier>=<value> ...`
 * where values containing whitespace MUST be wrapped in double quotes, and
 * multiple OR-alternatives for the same qualifier can be joined with `|`.
 *
 * Supported qualifiers (see backend `SearchParams.addXxx`):
 *   - name, extension, path       (single row per query, OR via `|`)
 *   - content                     (multiple rows allowed, AND between rows)
 *   - color                       (multiple rows allowed, AND between rows)
 *   - size=>N / size=<N           (numeric long, AND between rows)
 *   - modified=>ISO / modified=<ISO
 *   - created=>ISO / created=<ISO
 */

export const API_BASE_URL = "http://localhost:8080";

export const API = {
  search: `${API_BASE_URL}/api/search`,
  rankingAlgorithm: `${API_BASE_URL}/api/search/ranking_algorithm`,
  rag: {
    prompt: `${API_BASE_URL}/api/rag/prompt`,
    llmResponse: `${API_BASE_URL}/api/rag/llm_response`,
  },
  system: {
    index: `${API_BASE_URL}/api/system/index`,
    rootDirectoryRules: `${API_BASE_URL}/api/system/root_directory_rules`,
    ignoreDirectoryRules: `${API_BASE_URL}/api/system/ignore_directory_rules`,
    ignoreExtensionRules: `${API_BASE_URL}/api/system/ignore_extension_rules`,
    indexingReport: `${API_BASE_URL}/api/system/indexing_report`,
  },
  history: {
    topRequests: `${API_BASE_URL}/api/history/requests/top`,
    topResults: `${API_BASE_URL}/api/history/results/top`,
    suggestions: `${API_BASE_URL}/api/history/requests/suggestions`,
    requests: `${API_BASE_URL}/api/history/requests`,
    results: `${API_BASE_URL}/api/history/results`,
  },
} as const;

export type FilePreviewType = "TEXTUAL_FILE" | "IMAGE_FILE";

export type TextualFilePreview = {
  type: "TEXTUAL_FILE";
  fileName: string;
  filePath: string;
  content: string;
};

export type ImageFilePreview = {
  type: "IMAGE_FILE";
  fileName: string;
  filePath: string;
};

export type FilePreview = TextualFilePreview | ImageFilePreview;

export const isTextualFilePreview = (value: FilePreview): value is TextualFilePreview =>
  value.type === "TEXTUAL_FILE";

export const isImageFilePreview = (value: FilePreview): value is ImageFilePreview =>
  value.type === "IMAGE_FILE";

function previewTypeOf(candidate: Record<string, unknown>): string | undefined {
  if (typeof candidate.type === "string") return candidate.type;
  if (typeof candidate.fileType === "string") return candidate.fileType;
  return undefined;
}

export const isFilePreview = (value: unknown): value is FilePreview => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const previewType = previewTypeOf(candidate);
  if (
    typeof candidate.fileName !== "string" ||
    typeof candidate.filePath !== "string" ||
    previewType === undefined
  ) {
    return false;
  }
  if (previewType === "TEXTUAL_FILE") {
    return typeof candidate.content === "string";
  }
  if (previewType === "IMAGE_FILE") {
    return true;
  }
  return false;
};

function normalizeFilePreview(value: Record<string, unknown>): FilePreview {
  const previewType = previewTypeOf(value)!;
  const base = {
    fileName: value.fileName as string,
    filePath: value.filePath as string,
  };
  if (previewType === "TEXTUAL_FILE") {
    return { type: "TEXTUAL_FILE", ...base, content: value.content as string };
  }
  return { type: "IMAGE_FILE", ...base };
}

function mimeTypeForPath(filePath: string): string | undefined {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "bmp") return "image/bmp";
  if (ext === "svg") return "image/svg+xml";
  return undefined;
}

/** `POST /api/search/retrieve_image` — body is the absolute file path (plain text). */
export async function retrieveImage(filePath: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(`${API.search}/retrieve_image`, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: filePath,
    signal,
  });
  if (!response.ok) {
    throw new Error(`Failed to retrieve image (${response.status}).`);
  }
  const bytes = await response.arrayBuffer();
  const mime = response.headers.get("Content-Type") ?? mimeTypeForPath(filePath);
  return mime ? new Blob([bytes], { type: mime }) : new Blob([bytes]);
}

/** Submit a raw backend-format search string (plain text body). */
export async function postSearch(queryString: string, signal?: AbortSignal): Promise<FilePreview[]> {
  const response = await fetch(API.search, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: queryString,
    signal,
  });
  if (!response.ok) {
    const message = await response.text().catch(() => `status ${response.status}`);
    throw new SearchRequestError(response.status, message || `status ${response.status}`);
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) return [];
  return payload
    .filter(isFilePreview)
    .map((item) => normalizeFilePreview(item as Record<string, unknown>));
}

export class SearchRequestError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "SearchRequestError";
  }
}

/** `GET /api/history/requests/top?top=N` — returns map of request → usage count. */
export async function fetchTopRequests(top: number): Promise<Record<string, number>> {
  const url = `${API.history.topRequests}?top=${top}`;
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) throw new Error(`Failed to fetch top requests (${response.status}).`);
  const payload: unknown = await response.json();
  return normalizeNumberMap(payload);
}

/** `GET /api/history/results/top?top=N` — returns map of result path → hit count. */
export async function fetchTopResults(top: number): Promise<Record<string, number>> {
  const url = `${API.history.topResults}?top=${top}`;
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) throw new Error(`Failed to fetch top results (${response.status}).`);
  const payload: unknown = await response.json();
  return normalizeNumberMap(payload);
}

/** `GET /api/history/requests/suggestions?top=N&query=...` */
export async function fetchSuggestions(top: number, query: string, signal?: AbortSignal): Promise<string[]> {
  const url = `${API.history.suggestions}?top=${top}&query=${encodeURIComponent(query)}`;
  const response = await fetch(url, { method: "GET", signal });
  if (!response.ok) throw new Error(`Failed to fetch suggestions (${response.status}).`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) return [];
  return payload.filter((item): item is string => typeof item === "string");
}

export async function deleteRequestHistory(): Promise<void> {
  const response = await fetch(API.history.requests, { method: "DELETE" });
  if (!response.ok) throw new Error(`Failed to delete request history (${response.status}).`);
}

export async function deleteResultHistory(): Promise<void> {
  const response = await fetch(API.history.results, { method: "DELETE" });
  if (!response.ok) throw new Error(`Failed to delete result history (${response.status}).`);
}

export async function triggerIndexing(): Promise<void> {
  const response = await fetch(API.system.index, { method: "POST" });
  if (!response.ok) throw new Error(`Failed to trigger indexing (${response.status}).`);
}

/**
 * Browser fetch cannot send a request body with GET, so the frontend uses POST here.
 * If the backend keeps GET handlers, switch them to POST or accept a query param instead.
 */
export async function askRagResponse(request: string): Promise<string> {
  const response = await fetch(API.rag.llmResponse, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: request,
  });
  if (!response.ok) {
    const message = await response.text().catch(() => `status ${response.status}`);
    throw new Error(message || `Failed to get AI response (${response.status}).`);
  }
  return response.text();
}

/**
 * Backend `RankingStrategy` keys recognised by `SearchEngine.modifyRankingAlgorithm`.
 * Any unknown value falls back to `combined` server-side.
 */
export const RANKING_ALGORITHMS = [
  { value: "combined", label: "Combined", helper: "Default — blends relevance, recency and history." },
  { value: "alphabetic", label: "Alphabetic", helper: "Sort results by file name (A → Z)." },
  { value: "last_modified", label: "Last modified", helper: "Most recently changed files first." },
  { value: "history", label: "History", helper: "Promote files you've opened before." },
] as const;

export type RankingAlgorithm = (typeof RANKING_ALGORITHMS)[number]["value"];

export async function setRankingAlgorithm(algorithm: RankingAlgorithm): Promise<void> {
  const url = `${API.rankingAlgorithm}?type=${encodeURIComponent(algorithm)}`;
  const response = await fetch(url, { method: "POST" });
  if (!response.ok) {
    throw new Error(`Failed to set ranking algorithm (${response.status}).`);
  }
}

function normalizeNumberMap(payload: unknown): Record<string, number> {
  if (typeof payload !== "object" || payload === null) return {};
  const entries = Object.entries(payload as Record<string, unknown>);
  const out: Record<string, number> = {};
  for (const [key, value] of entries) {
    const n =
      typeof value === "number" && Number.isFinite(value)
        ? value
        : typeof value === "string" && Number.isFinite(Number(value))
          ? Number(value)
          : 0;
    out[key] = n;
  }
  return out;
}
