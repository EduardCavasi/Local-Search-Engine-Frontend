import { useCallback, useEffect, useState } from "react";

const API_BASE_URL = "http://localhost:8080";
/** How often to refresh stats while the modal is open (ms). */
const STATS_POLL_INTERVAL_MS = 2000;

export type IndexingStats = {
  modifiedCount?: number;
  skippedCount?: number;
  newCount?: number;
  deletedCount?: number;
  errorCount?: number;
  ignoredCount?: number;
  nonTextualCount?: number;
};

const STAT_ROWS: Array<{ key: keyof IndexingStats; label: string; hint: string }> = [
  { key: "newCount", label: "New", hint: "Newly indexed files" },
  { key: "modifiedCount", label: "Modified", hint: "Files changed since last index" },
  { key: "deletedCount", label: "Deleted", hint: "Removed from index" },
  { key: "skippedCount", label: "Skipped", hint: "Skipped during indexing" },
  { key: "ignoredCount", label: "Ignored", hint: "Matched ignore rules" },
  { key: "nonTextualCount", label: "Non-textual", hint: "Not treated as text" },
  { key: "errorCount", label: "Errors", hint: "Indexing errors" },
];

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (value && typeof value === "object" && "get" in value) {
    // Fallback if backend ever serializes oddly
    const v = (value as { get?: () => number }).get?.();
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return 0;
}

function normalizeStats(raw: unknown): IndexingStats {
  if (typeof raw !== "object" || raw === null) return {};
  const o = raw as Record<string, unknown>;
  const pick = (camel: string, pascal: string): number =>
    toNumber(o[camel] ?? o[pascal]);

  return {
    modifiedCount: pick("modifiedCount", "ModifiedCount"),
    skippedCount: pick("skippedCount", "SkippedCount"),
    newCount: pick("newCount", "NewCount"),
    deletedCount: pick("deletedCount", "DeletedCount"),
    errorCount: pick("errorCount", "ErrorCount"),
    ignoredCount: pick("ignoredCount", "IgnoredCount"),
    nonTextualCount: pick("nonTextualCount", "NonTextualCount"),
  };
}

function IndexingStatsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<IndexingStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadStats = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) {
      setIsLoading(true);
      setErrorMessage("");
    }
    try {
      const response = await fetch(`${API_BASE_URL}/get_indexing_report`, {
        method: "GET",
      });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      const payload: unknown = await response.json();
      setStats(normalizeStats(payload));
      if (!silent) setErrorMessage("");
    } catch (error) {
      console.error(error);
      if (!silent) {
        setErrorMessage("Could not load indexing stats.");
        setStats(null);
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    void loadStats({ silent: false });

    const intervalId = window.setInterval(() => {
      void loadStats({ silent: true });
    }, STATS_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [isOpen, loadStats]);

  const openModal = () => {
    setIsOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
      >
        Indexing stats
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Indexing report</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
              >
                Close
              </button>
            </div>

            <div className="p-5">
              {errorMessage ? (
                <p className="mb-4 text-sm text-red-300">{errorMessage}</p>
              ) : null}

              {isLoading ? (
                <p className="text-sm text-slate-400">Loading stats…</p>
              ) : stats ? (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {STAT_ROWS.map(({ key, label, hint }) => (
                    <li
                      key={key}
                      className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3"
                    >
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {label}
                      </p>
                      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-cyan-300">
                        {toNumber(stats[key])}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{hint}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">No data.</p>
              )}

              <div className="mt-6 flex justify-end border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => void loadStats({ silent: false })}
                  disabled={isLoading}
                  className="rounded-lg border border-cyan-700 bg-cyan-950/40 px-4 py-2 text-sm text-cyan-200 transition hover:border-cyan-500 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default IndexingStatsModal;
