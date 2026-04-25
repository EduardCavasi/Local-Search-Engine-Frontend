import { useEffect, useRef, useState } from "react";
import {
  RANKING_ALGORITHMS,
  setRankingAlgorithm,
  type RankingAlgorithm,
} from "../api";

const STORAGE_KEY = "rankingAlgorithm";
const DEFAULT_ALGORITHM: RankingAlgorithm = "combined";

function isRankingAlgorithm(value: unknown): value is RankingAlgorithm {
  return (
    typeof value === "string" &&
    RANKING_ALGORITHMS.some((option) => option.value === value)
  );
}

function loadInitialAlgorithm(): RankingAlgorithm {
  if (typeof window === "undefined") return DEFAULT_ALGORITHM;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isRankingAlgorithm(stored)) return stored;
  } catch {
    /* ignore — fall back to default */
  }
  return DEFAULT_ALGORITHM;
}

function RankingAlgorithmPicker() {
  const [algorithm, setAlgorithm] = useState<RankingAlgorithm>(loadInitialAlgorithm);
  const [isOpen, setIsOpen] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  /** Sync the persisted choice to the backend on mount so server matches UI even after a restart. */
  useEffect(() => {
    void setRankingAlgorithm(algorithm).catch((error: unknown) => {
      console.error("Failed to sync initial ranking algorithm:", error);
    });
    // intentionally only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Close the popover when clicking outside or pressing Escape. */
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handlePick = async (next: RankingAlgorithm) => {
    if (next === algorithm) {
      setIsOpen(false);
      return;
    }
    setIsApplying(true);
    setErrorMessage("");
    try {
      await setRankingAlgorithm(next);
      setAlgorithm(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore storage failure */
      }
      setIsOpen(false);
    } catch (error) {
      console.error(error);
      setErrorMessage("Could not apply ranking algorithm.");
    } finally {
      setIsApplying(false);
    }
  };

  const activeOption =
    RANKING_ALGORITHMS.find((option) => option.value === algorithm) ?? RANKING_ALGORITHMS[0];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={isApplying}
        title={`Ranking: ${activeOption.label}`}
        className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="text-slate-400">Rank:</span>
        <span className="font-medium text-cyan-200">{activeOption.label}</span>
        <span className="ml-0.5 text-xs text-slate-500" aria-hidden>
          ▾
        </span>
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-slate-800 bg-slate-900 p-2 shadow-2xl shadow-slate-950/60"
        >
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Ranking algorithm
          </p>
          <ul className="space-y-1">
            {RANKING_ALGORITHMS.map((option) => {
              const isActive = option.value === algorithm;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    onClick={() => void handlePick(option.value)}
                    disabled={isApplying}
                    className={`w-full rounded-md px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      isActive
                        ? "bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-500/40"
                        : "text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{option.label}</span>
                      {isActive ? (
                        <span className="text-[10px] uppercase tracking-wide text-cyan-300">
                          active
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">{option.helper}</p>
                  </button>
                </li>
              );
            })}
          </ul>
          {errorMessage ? (
            <p className="mt-2 px-2 text-xs text-red-300">{errorMessage}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default RankingAlgorithmPicker;
