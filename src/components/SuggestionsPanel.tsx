import { useEffect, useRef, useState } from "react";
import { fetchSuggestions } from "../api";

const TOP_N = 3;
/** Debounce so the server isn't hammered while the user types. */
const SUGGESTION_DEBOUNCE_MS = 220;

type SuggestionsPanelProps = {
  query: string;
  onPick: (suggestion: string) => void;
};

function SuggestionsPanel({ query, onPick }: SuggestionsPanelProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const requestSeqRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      setErrorMessage("");
      return;
    }

    const requestId = ++requestSeqRef.current;
    const controller = new AbortController();

    const timer = window.setTimeout(() => {
      void fetchSuggestions(TOP_N, trimmed, controller.signal)
        .then((list) => {
          if (requestId !== requestSeqRef.current) return;
          setSuggestions(list);
          setErrorMessage("");
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          if (requestId !== requestSeqRef.current) return;
          console.error("Suggestions request failed:", error);
          setErrorMessage("Could not load suggestions.");
          setSuggestions([]);
        });
    }, SUGGESTION_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  if (!query.trim()) return null;
  if (suggestions.length === 0 && !errorMessage) return null;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Suggestions
        </p>
        <span className="text-[10px] text-slate-500">top {TOP_N}</span>
      </div>

      {errorMessage ? (
        <p className="mt-2 text-xs text-red-300">{errorMessage}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion}-${index}`}>
              <button
                type="button"
                onClick={() => onPick(suggestion)}
                className="group flex w-full items-start gap-2 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-left transition hover:border-cyan-500/60 hover:bg-slate-900"
              >
                <span className="mt-0.5 shrink-0 rounded-sm bg-slate-800 px-1.5 text-[10px] font-semibold text-slate-300 group-hover:bg-cyan-500/30 group-hover:text-cyan-100">
                  {index + 1}
                </span>
                <span className="break-all font-mono text-xs text-slate-200 group-hover:text-cyan-100">
                  {suggestion}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default SuggestionsPanel;
