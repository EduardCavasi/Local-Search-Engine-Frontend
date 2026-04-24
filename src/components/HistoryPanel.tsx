import { useCallback, useEffect, useState } from "react";
import {
  deleteRequestHistory,
  deleteResultHistory,
  fetchTopRequests,
  fetchTopResults,
} from "../api";

const TOP_N = 5;

type HistoryTab = "requests" | "results";

const TAB_CONFIG: Array<{ id: HistoryTab; label: string; helper: string }> = [
  {
    id: "requests",
    label: "Top requests",
    helper: "Most frequently executed search queries.",
  },
  {
    id: "results",
    label: "Top results",
    helper: "Files most often opened from search results.",
  },
];

type HistoryPanelProps = {
  onPickRequest?: (request: string) => void;
};

function HistoryPanel({ onPickRequest }: HistoryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<HistoryTab>("requests");
  const [requests, setRequests] = useState<Array<[string, number]>>([]);
  const [results, setResults] = useState<Array<[string, number]>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const [topRequests, topResults] = await Promise.all([
        fetchTopRequests(TOP_N),
        fetchTopResults(TOP_N),
      ]);
      setRequests(sortEntries(topRequests));
      setResults(sortEntries(topResults));
    } catch (error) {
      console.error(error);
      setErrorMessage("Could not load history from backend.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void loadAll();
  }, [isOpen, loadAll]);

  const clearActive = async () => {
    setErrorMessage("");
    setIsLoading(true);
    try {
      if (activeTab === "requests") {
        await deleteRequestHistory();
        setRequests([]);
      } else {
        await deleteResultHistory();
        setResults([]);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("Could not clear history.");
    } finally {
      setIsLoading(false);
    }
  };

  const activeEntries = activeTab === "requests" ? requests : results;
  const activeHelper = TAB_CONFIG.find((tab) => tab.id === activeTab)?.helper ?? "";
  const maxCount = activeEntries.reduce((acc, [, count]) => Math.max(acc, count), 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
      >
        History
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Search history</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Ranked by recent usage · top {TOP_N}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
              >
                Close
              </button>
            </div>

            <div className="flex border-b border-slate-800">
              {TAB_CONFIG.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-4 py-2.5 text-sm transition ${
                    activeTab === tab.id
                      ? "border-b-2 border-cyan-400 text-cyan-200"
                      : "border-b-2 border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-400">{activeHelper}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void loadAll()}
                    disabled={isLoading}
                    className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-slate-100 disabled:opacity-50"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => void clearActive()}
                    disabled={isLoading || activeEntries.length === 0}
                    className="rounded-md border border-red-900/60 bg-red-950/40 px-2.5 py-1 text-xs text-red-200 transition hover:border-red-500 hover:text-red-100 disabled:opacity-40"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {errorMessage ? (
                <p className="mb-3 text-sm text-red-300">{errorMessage}</p>
              ) : null}

              {isLoading && activeEntries.length === 0 ? (
                <p className="text-sm text-slate-400">Loading history…</p>
              ) : activeEntries.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-700 px-3 py-2 text-sm text-slate-400">
                  No history yet. Run a few searches to populate this list.
                </p>
              ) : (
                <ol className="space-y-2">
                  {activeEntries.map(([key, count], index) => {
                    const width = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
                    const isRequest = activeTab === "requests";
                    return (
                      <li
                        key={`${key}-${index}`}
                        className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2"
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 shrink-0 rounded-sm bg-slate-800 px-1.5 text-[10px] font-semibold text-slate-300">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            {isRequest && onPickRequest ? (
                              <button
                                type="button"
                                onClick={() => {
                                  onPickRequest(key);
                                  setIsOpen(false);
                                }}
                                className="w-full break-all text-left font-mono text-xs text-slate-200 hover:text-cyan-200"
                              >
                                {key}
                              </button>
                            ) : (
                              <p className="break-all font-mono text-xs text-slate-200">
                                {key}
                              </p>
                            )}
                            <div className="mt-1.5 flex items-center gap-2">
                              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-800">
                                <div
                                  className="h-full rounded-full bg-cyan-500/80"
                                  style={{ width: `${width}%` }}
                                />
                              </div>
                              <span className="shrink-0 font-mono text-xs tabular-nums text-cyan-300">
                                {count}
                              </span>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function sortEntries(map: Record<string, number>): Array<[string, number]> {
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

export default HistoryPanel;
