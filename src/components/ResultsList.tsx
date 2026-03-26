import type { ReactNode } from "react";

export type FilePreview = {
  fileName: string;
  filePath: string;
  content: string;
};

export type SearchHighlights = {
  fileName?: string;
  fileExtension?: string;
  filePath?: string;
  content?: string;
};

type ResultsListProps = {
  query: string;
  results: FilePreview[];
  isSearching: boolean;
  highlights?: SearchHighlights;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitHighlightTerms(value: string | undefined): string[] {
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  return trimmed.split(/\s+/).filter(Boolean);
}

/** Highlights all given terms (case-insensitive); longer terms first to reduce overlap issues. */
function highlightTerms(text: string, terms: (string | undefined)[]): ReactNode {
  const cleaned = terms
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .map((t) => t.trim());
  if (cleaned.length === 0) return text;
  cleaned.sort((a, b) => b.length - a.length);
  const pattern = cleaned.map(escapeRegExp).join("|");
  const regex = new RegExp(`(${pattern})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark
        key={i}
        className="rounded-sm bg-amber-500/45 px-0.5 text-amber-50 ring-1 ring-amber-400/30"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function ResultsList({ query, results, isSearching, highlights }: ResultsListProps) {
  const hasQuery = query.length > 0;
  const fileNameTerms = splitHighlightTerms(highlights?.fileName);
  const fileExtensionTerms = splitHighlightTerms(highlights?.fileExtension);
  const filePathTerms = splitHighlightTerms(highlights?.filePath);
  const contentTerms = splitHighlightTerms(highlights?.content);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="text-sm font-semibold text-slate-200">Results</h2>

      {!hasQuery ? (
        <p className="mt-2 text-sm text-slate-400">
          Start typing to search your local files.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-400">
            {isSearching
              ? "Searching..."
              : `${results.length} result${results.length === 1 ? "" : "s"} for "${query}"`}
          </p>

          <ul className="mt-3 space-y-2">
            {results.map((result) => (
              <li
                key={`${result.filePath}:${result.fileName}`}
                className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
              >
                <p className="font-medium text-cyan-200">
                  {highlightTerms(result.fileName, [
                    ...fileNameTerms,
                    ...fileExtensionTerms,
                  ])}
                </p>
                <p className="mt-1 text-xs text-slate-400 break-all">
                  {highlightTerms(result.filePath, filePathTerms)}
                </p>
                <pre className="app-scrollbar mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-300">
                  {highlightTerms(result.content, contentTerms)}
                </pre>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default ResultsList;
