import { useCallback, useEffect, useRef, useState } from "react";
import ResultsList from "./components/ResultsList";
import SearchBar, { type SearchBarChange, type SearchHighlights } from "./components/SearchBar";
import SettingsPanel from "./components/SettingsPanel";
import IndexingStatsModal from "./components/IndexingStatsModal";
import HistoryPanel from "./components/HistoryPanel";
import SuggestionsPanel from "./components/SuggestionsPanel";
import { postSearch, triggerIndexing, type FilePreview, SearchRequestError } from "./api";

/** Wait after last query change before POST /api/search — avoids hammering the backend on every keystroke. */
const SEARCH_POST_DEBOUNCE_MS = 500;

function App() {
  const [barChange, setBarChange] = useState<SearchBarChange>({
    queryString: "",
    highlights: {},
  });
  /** When non-null, the effective query is a raw backend string (e.g. picked from a suggestion / history). */
  const [rawOverride, setRawOverride] = useState<string | null>(null);
  const [results, setResults] = useState<FilePreview[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string>("");
  const [isReindexing, setIsReindexing] = useState(false);
  const hasIndexedRef = useRef(false);
  /** Monotonic id so stale responses can be safely ignored without aborting the HTTP connection. */
  const searchRequestSeqRef = useRef(0);

  const effectiveQuery = rawOverride ?? barChange.queryString;
  const effectiveHighlights: SearchHighlights = rawOverride ? {} : barChange.highlights;

  const triggerReindex = useCallback(async () => {
    setIsReindexing(true);
    try {
      await triggerIndexing();
    } catch (error) {
      console.error("Index request failed:", error);
    } finally {
      setIsReindexing(false);
    }
  }, []);

  const handleSearchBarChange = useCallback((change: SearchBarChange) => {
    setBarChange(change);
    setRawOverride(null);
  }, []);

  const handleSuggestionPick = useCallback((suggestion: string) => {
    setRawOverride(suggestion);
  }, []);

  const handleHistoryPick = useCallback((request: string) => {
    setRawOverride(request);
  }, []);

  const clearRawOverride = useCallback(() => {
    setRawOverride(null);
  }, []);

  useEffect(() => {
    if (hasIndexedRef.current) return;
    hasIndexedRef.current = true;
    void triggerReindex();
  }, [triggerReindex]);

  useEffect(() => {
    if (!effectiveQuery) {
      setResults([]);
      setSearchError("");
      setIsSearching(false);
      return;
    }

    const debounceTimer = window.setTimeout(() => {
      const requestId = ++searchRequestSeqRef.current;
      setIsSearching(true);

      void postSearch(effectiveQuery)
        .then((parsedResults) => {
          if (requestId !== searchRequestSeqRef.current) return;
          setResults(parsedResults);
          setSearchError("");
        })
        .catch((error: unknown) => {
          console.error("Search request failed:", error);
          if (requestId !== searchRequestSeqRef.current) return;
          setResults([]);
          if (error instanceof SearchRequestError && error.status === 400) {
            setSearchError(error.message);
          } else if (error instanceof Error) {
            setSearchError(error.message);
          } else {
            setSearchError("Search request failed.");
          }
        })
        .finally(() => {
          if (requestId === searchRequestSeqRef.current) {
            setIsSearching(false);
          }
        });
    }, SEARCH_POST_DEBOUNCE_MS);

    return () => window.clearTimeout(debounceTimer);
  }, [effectiveQuery]);

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
            <HistoryPanel onPickRequest={handleHistoryPick} />
            <IndexingStatsModal />
            <SettingsPanel />
          </div>
        </header>

        <SearchBar
          onQueryChange={handleSearchBarChange}
          rawOverride={rawOverride}
          onClearRawOverride={clearRawOverride}
        />

        <SuggestionsPanel query={effectiveQuery} onPick={handleSuggestionPick} />

        {searchError ? (
          <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            <p className="font-semibold">Search request rejected</p>
            <p className="mt-1 break-all font-mono text-xs text-red-200/80">{searchError}</p>
          </div>
        ) : null}

        <ResultsList
          query={effectiveQuery}
          results={results}
          isSearching={isSearching}
          highlights={effectiveHighlights}
        />
      </section>
    </main>
  );
}

export default App;
