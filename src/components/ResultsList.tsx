import { type ReactNode } from "react";
import {
  isImageFilePreview,
  isTextualFilePreview,
  type FilePreview,
  type SearchResult,
} from "../api";
import ImagePreview from "./ImagePreview";
import type { SearchHighlights } from "./SearchBar";

export type { FilePreview, SearchHighlights };

type ResultsListProps = {
  query: string;
  searchResult: SearchResult | null;
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

function formatFileCounts(counts: SearchResult["fileCounts"]): string | null {
  const parts: string[] = [];
  const textual = counts.TEXTUAL_FILE ?? 0;
  const images = counts.IMAGE_FILE ?? 0;
  if (textual > 0) parts.push(`${textual} text`);
  if (images > 0) parts.push(`${images} image${images === 1 ? "" : "s"}`);
  return parts.length > 0 ? parts.join(", ") : null;
}

function ResultsList({ query, searchResult, isSearching, highlights }: ResultsListProps) {
  const hasQuery = query.length > 0;
  const resultsMatchQuery =
    searchResult !== null && searchResult.query === query;
  const results = resultsMatchQuery ? searchResult.filePreviews : [];
  const fileNameTerms = splitHighlightTerms(highlights?.fileName);
  const fileExtensionTerms = splitHighlightTerms(highlights?.fileExtension);
  const filePathTerms = splitHighlightTerms(highlights?.filePath);
  const contentTerms = splitHighlightTerms(highlights?.content);
  const countSummary = resultsMatchQuery ? formatFileCounts(searchResult.fileCounts) : null;

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
            {!isSearching && countSummary ? (
              <span className="text-slate-500"> ({countSummary})</span>
            ) : null}
          </p>

          <ul key={query} className="mt-3 space-y-2">
            {results.map((result, index) => (
              <li
                key={`${query}:${index}:${result.filePath}`}
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
                {isTextualFilePreview(result) && (
                  <pre className="app-scrollbar mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-300">
                    {highlightTerms(result.content, contentTerms)}
                  </pre>
                )}
                {isImageFilePreview(result) && (
                  <ImagePreview filePath={result.filePath} fileName={result.fileName} />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default ResultsList;
