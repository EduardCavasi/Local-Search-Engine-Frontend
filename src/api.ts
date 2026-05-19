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

export type WidgetType = "ENTITY_EXTRACTION" | "IMAGE_GALLERY" | "ANALYZE_LOGS";

export type EntityStat = { count: number; values: string[] };

export type EntityExtractionPayload = {
  widget_type: "ENTITY_EXTRACTION";
  stats: {
    emails: EntityStat;
    ip_addresses: EntityStat;
    urls: EntityStat;
  };
};

export type AnalyzeLogsPayload = {
  widget_type: "ANALYZE_LOGS";
  stats: {
    log_count: number;
    error_count: number;
    warn_count: number;
    info_count: number;
  };
  topExceptions: Array<{ exception: string; count: number }>;
  logFiles: string[];
};

export type ImageGalleryPayload = {
  widget_type: "IMAGE_GALLERY";
  nr_images: number;
  images: string[];
};

export type WidgetPayload = EntityExtractionPayload | AnalyzeLogsPayload | ImageGalleryPayload;

export type FileCounts = Partial<Record<"TEXTUAL_FILE" | "IMAGE_FILE" | "UNKNOWN", number>>;

export type SearchResult = {
  query: string;
  filePreviews: FilePreview[];
  fileCounts: FileCounts;
  widgetPayloads: WidgetPayload[];
};

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

function widgetTypeOf(candidate: Record<string, unknown>): WidgetType | null {
  const raw = candidate.widget_type;
  if (typeof raw === "string") return raw as WidgetType;
  if (typeof raw === "object" && raw !== null && typeof (raw as Record<string, unknown>).name === "string") {
    return (raw as Record<string, unknown>).name as WidgetType;
  }
  return null;
}

function parseEntityStat(value: unknown): EntityStat {
  if (typeof value !== "object" || value === null) return { count: 0, values: [] };
  const o = value as Record<string, unknown>;
  const values = Array.isArray(o.values)
    ? o.values.filter((v): v is string => typeof v === "string")
    : [];
  const count = typeof o.count === "number" ? o.count : values.length;
  return { count, values };
}

function parseWidgetPayload(value: unknown): WidgetPayload | null {
  if (typeof value !== "object" || value === null) return null;
  const o = value as Record<string, unknown>;
  const widgetType = widgetTypeOf(o);
  if (!widgetType) return null;

  if (widgetType === "ENTITY_EXTRACTION") {
    const statsRaw = o.stats;
    if (typeof statsRaw !== "object" || statsRaw === null) return null;
    const stats = statsRaw as Record<string, unknown>;
    return {
      widget_type: "ENTITY_EXTRACTION",
      stats: {
        emails: parseEntityStat(stats.emails),
        ip_addresses: parseEntityStat(stats.ip_addresses),
        urls: parseEntityStat(stats.urls),
      },
    };
  }

  if (widgetType === "ANALYZE_LOGS") {
    const statsRaw = o.stats;
    if (typeof statsRaw !== "object" || statsRaw === null) return null;
    const stats = statsRaw as Record<string, unknown>;
    const topExceptions = Array.isArray(o.topExceptions)
      ? o.topExceptions
          .map((item) => {
            if (typeof item !== "object" || item === null) return null;
            const row = item as Record<string, unknown>;
            if (typeof row.exception !== "string") return null;
            const count = typeof row.count === "number" ? row.count : 0;
            return { exception: row.exception, count };
          })
          .filter((item): item is { exception: string; count: number } => item !== null)
      : [];
    const logFiles = Array.isArray(o.logFiles)
      ? o.logFiles.filter((p): p is string => typeof p === "string")
      : [];
    return {
      widget_type: "ANALYZE_LOGS",
      stats: {
        log_count: typeof stats.log_count === "number" ? stats.log_count : 0,
        error_count: typeof stats.error_count === "number" ? stats.error_count : 0,
        warn_count: typeof stats.warn_count === "number" ? stats.warn_count : 0,
        info_count: typeof stats.info_count === "number" ? stats.info_count : 0,
      },
      topExceptions,
      logFiles,
    };
  }

  if (widgetType === "IMAGE_GALLERY") {
    const images = Array.isArray(o.images)
      ? o.images.filter((p): p is string => typeof p === "string")
      : [];
    return {
      widget_type: "IMAGE_GALLERY",
      nr_images: typeof o.nr_images === "number" ? o.nr_images : images.length,
      images,
    };
  }

  return null;
}

function parseFileCounts(value: unknown): FileCounts {
  if (typeof value !== "object" || value === null) return {};
  const o = value as Record<string, unknown>;
  const out: FileCounts = {};
  for (const key of ["TEXTUAL_FILE", "IMAGE_FILE", "UNKNOWN"] as const) {
    const n = o[key];
    if (typeof n === "number" && Number.isFinite(n)) out[key] = n;
  }
  return out;
}

function countFileTypes(previews: FilePreview[]): FileCounts {
  const counts: FileCounts = {};
  for (const preview of previews) {
    counts[preview.type] = (counts[preview.type] ?? 0) + 1;
  }
  return counts;
}

function emptySearchResult(query: string): SearchResult {
  return { query, filePreviews: [], fileCounts: {}, widgetPayloads: [] };
}

export function parseSearchResult(payload: unknown, fallbackQuery: string): SearchResult {
  if (Array.isArray(payload)) {
    const filePreviews = payload
      .filter(isFilePreview)
      .map((item) => normalizeFilePreview(item as Record<string, unknown>));
    return {
      query: fallbackQuery,
      filePreviews,
      fileCounts: countFileTypes(filePreviews),
      widgetPayloads: [],
    };
  }

  if (typeof payload !== "object" || payload === null) {
    return emptySearchResult(fallbackQuery);
  }

  const o = payload as Record<string, unknown>;
  const query = typeof o.query === "string" ? o.query : fallbackQuery;
  const rawPreviews = Array.isArray(o.filePreviews) ? o.filePreviews : [];
  const filePreviews = rawPreviews
    .filter(isFilePreview)
    .map((item) => normalizeFilePreview(item as Record<string, unknown>));
  const fileCounts =
    o.fileCounts !== undefined ? parseFileCounts(o.fileCounts) : countFileTypes(filePreviews);
  const widgetPayloads = Array.isArray(o.widgetPayloads)
    ? o.widgetPayloads
        .map(parseWidgetPayload)
        .filter((w): w is WidgetPayload => w !== null)
    : [];

  return { query, filePreviews, fileCounts, widgetPayloads };
}

/** Submit a raw backend-format search string (plain text body). */
export async function postSearch(queryString: string, signal?: AbortSignal): Promise<SearchResult> {
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
  return parseSearchResult(payload, queryString);
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
