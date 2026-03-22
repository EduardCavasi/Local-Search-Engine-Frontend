import { useEffect, useMemo, useRef, useState } from "react";
import ResultsList from "./components/ResultsList";
import type { FilePreview } from "./components/ResultsList";
import SearchBar from "./components/SearchBar";
import SettingsPanel from "./components/SettingsPanel";
import IndexingStatsModal from "./components/IndexingStatsModal";
const SEARCH_DEBOUNCE_MS = 180;
/** Wait after last query change before POST /search — avoids aborting long server work on every keystroke. */
const SEARCH_POST_DEBOUNCE_MS = 500;
const METADATA_KEYS = [
  "size>",
  "size<",
  "lastModified>",
  "lastModified<",
  "lastAccessed>",
  "lastAccessed<",
  "created>",
  "created<",
] as const;
const FILE_KEYS = ["fileName", "fileExtension", "filePath"] as const;
const CONTENT_KEYS = ["content"] as const;
const KEYWORDS = [...FILE_KEYS, ...METADATA_KEYS, ...CONTENT_KEYS];

type ParsedQuery = {
  errors?: string[];
  needsContent?: boolean;
  needsMetadata?: boolean;
  queryFileName?: string;
  queryFileExtension?: string;
  queryFilePath?: string;
  queryContent?: string;
  querySize?: bigint;
  queryLastModified?: number;
  queryLastAccessed?: number;
  queryCreated?: number;
  /** `true` for `size>`, `false` for `size<`. */
  greaterSize?: boolean;
  /** `true` for `lastModified>`, `false` for `lastModified<`. */
  lastModifiedAfter?: boolean;
  /** `true` for `lastAccessed>`, `false` for `lastAccessed<`. */
  lastAccessedAfter?: boolean;
  /** `true` for `created>`, `false` for `created<`. */
  createdAfter?: boolean;
};

const isKeyword = (value: string): value is (typeof KEYWORDS)[number] =>
  KEYWORDS.includes(value as (typeof KEYWORDS)[number]);
const isContentKey = (value: string): value is (typeof CONTENT_KEYS)[number] =>
  CONTENT_KEYS.includes(value as (typeof CONTENT_KEYS)[number]);
const isMetadataKey = (value: string): value is (typeof METADATA_KEYS)[number] =>
  METADATA_KEYS.includes(value as (typeof METADATA_KEYS)[number]);

const toFileTimeMillis = (value: string): number | undefined => {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

/** Split `key:value` only on the first `:`, so values can contain colons (e.g. `C:/Users/...`). */
const splitKeyValue = (subquery: string): [string, string] | null => {
  const trimmed = subquery.trim();
  const colonIndex = trimmed.indexOf(":");
  if (colonIndex === -1) return null;
  const key = trimmed.slice(0, colonIndex).trim();
  const value = trimmed.slice(colonIndex + 1).trim();
  return [key, value];
};

/** Spring/Jackson: send times as ISO-8601 UTC (`…Z`), same instant as epoch millis. */
const toRequestBody = (value: ParsedQuery) =>
  JSON.stringify(value, (key, currentValue) => {
    if (typeof currentValue === "bigint") return currentValue.toString();
    if (
      (key === "queryLastModified" ||
        key === "queryLastAccessed" ||
        key === "queryCreated") &&
      typeof currentValue === "number" &&
      Number.isFinite(currentValue)
    ) {
      return new Date(currentValue).toISOString();
    }
    return currentValue;
  });

const isFilePreview = (value: unknown): value is FilePreview => {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.fileName === "string" &&
    typeof candidate.filePath === "string" &&
    typeof candidate.content === "string"
  );
};

function App() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<FilePreview[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const hasIndexedRef = useRef(false);
  /** Monotonic id so we never abort the HTTP connection; we ignore stale responses instead (prevents Spring async write errors). */
  const searchRequestSeqRef = useRef(0);

  const triggerReindex = async () => {
    setIsReindexing(true);
    try {
      const response = await fetch("http://localhost:8080/index", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Reindex failed with status ${response.status}`);
      }
    } catch (error) {
      console.error("Index request failed:", error);
    } finally {
      setIsReindexing(false);
    }
  };

  const preparedQuery = useMemo(() => {
    const normalizedQuery = query.trim().split(";");
    const result: ParsedQuery = {};
    const errors: string[] = [];

    normalizedQuery.forEach((subquery) => {
      const pair = splitKeyValue(subquery);
      if (!pair) return;
      let [key, value] = pair;
      if (!value || !isKeyword(key)) return;

      if (isContentKey(key)) {
        result.needsContent = true;
      }
      if (isMetadataKey(key)) {
        result.needsMetadata = true;
      }

      if (key.endsWith(">") || key.endsWith("<")) {
        const isAfter = key.endsWith(">");
        const baseKey = key.slice(0, -1);
        if (baseKey === "size") {
          result.greaterSize = isAfter;
        } else if (baseKey === "lastModified") {
          result.lastModifiedAfter = isAfter;
        } else if (baseKey === "lastAccessed") {
          result.lastAccessedAfter = isAfter;
        } else if (baseKey === "created") {
          result.createdAfter = isAfter;
        }
        key = baseKey;
      }

      const queryKey =
        `query${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof ParsedQuery;
      if (queryKey === "querySize") {
        try {
          result.querySize = BigInt(value);
        } catch {
          errors.push(
            `Invalid size value "${value}". Expected an integer compatible with Java long.`,
          );
        }
        return;
      }
      if (
        queryKey === "queryCreated" ||
        queryKey === "queryLastModified" ||
        queryKey === "queryLastAccessed"
      ) {
        const fileTimeMillis = toFileTimeMillis(value);
        if (fileTimeMillis !== undefined) {
          result[queryKey] = fileTimeMillis;
        } else {
          errors.push(
            `Invalid ${queryKey} value "${value}". Expected a date/time parseable to Java FileTime (epoch millis).`,
          );
        }
        return;
      }

      if (
        queryKey === "queryFileName" ||
        queryKey === "queryFileExtension" ||
        queryKey === "queryFilePath" ||
        queryKey === "queryContent"
      ) {
        result[queryKey] = value;
      }
    });

    if (errors.length > 0) {
      result.errors = errors;
    }

    return result;
  }, [query]);

  const requestBody = useMemo(() => toRequestBody(preparedQuery), [preparedQuery]);

  useEffect(() => {
    if (hasIndexedRef.current) return;
    hasIndexedRef.current = true;
    void triggerReindex();
  }, []);

  useEffect(() => {
    const debounceTimer = window.setTimeout(() => {
      const requestId = ++searchRequestSeqRef.current;
      setIsSearching(true);

      void fetch("http://localhost:8080/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: requestBody,
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Search request failed with status ${response.status}`);
          }

          const payload: unknown = await response.json();
          if (!Array.isArray(payload)) {
            throw new Error("Search response is not an array.");
          }

          if (requestId !== searchRequestSeqRef.current) return;

          const parsedResults = payload.filter(isFilePreview);
          setResults(parsedResults);
        })
        .catch((error) => {
          console.error("Search request failed:", error);
          if (requestId !== searchRequestSeqRef.current) return;
          setResults([]);
        })
        .finally(() => {
          if (requestId === searchRequestSeqRef.current) {
            setIsSearching(false);
          }
        });
    }, SEARCH_POST_DEBOUNCE_MS);

    return () => window.clearTimeout(debounceTimer);
  }, [requestBody]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-cyan-300">
            Local File Search Engine
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void triggerReindex()}
              disabled={isReindexing}
              className="rounded-lg border border-cyan-700 bg-cyan-950/40 px-3 py-2 text-sm text-cyan-200 transition hover:border-cyan-500 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isReindexing ? "Reindexing..." : "Reindex"}
            </button>
            <IndexingStatsModal />
            <SettingsPanel />
          </div>
        </header>

        <SearchBar
          onQueryChange={setQuery}
        />

        <ResultsList
          query={debouncedQuery}
          results={results}
          isSearching={isSearching}
          highlights={{
            fileName: preparedQuery.queryFileName,
            fileExtension: preparedQuery.queryFileExtension,
            filePath: preparedQuery.queryFilePath,
            content: preparedQuery.queryContent,
          }}
        />
      </section>
    </main>
  );
}

export default App;
