import { useEffect, useMemo, useState } from "react";

const FILTER_OPTIONS = [
  { value: "fileName", label: "File name" },
  { value: "fileExtension", label: "File extension" },
  { value: "filePath", label: "File path" },
  { value: "content", label: "Content" },
  { value: "size>", label: "Size >" },
  { value: "size<", label: "Size <" },
  { value: "lastModified>", label: "Last modified >" },
  { value: "lastModified<", label: "Last modified <" },
  { value: "lastAccessed>", label: "Last accessed >" },
  { value: "lastAccessed<", label: "Last accessed <" },
  { value: "created>", label: "Created >" },
  { value: "created<", label: "Created <" },
] as const;
const SIZE_KEYS = ["size>", "size<"] as const;
const TIME_KEYS = [
  "lastModified>",
  "lastModified<",
  "lastAccessed>",
  "lastAccessed<",
  "created>",
  "created<",
] as const;

type FilterKey = (typeof FILTER_OPTIONS)[number]["value"];
type FilterRow = { id: number; key: FilterKey; value: string };

type SearchBarProps = {
  onQueryChange: (value: string) => void;
};

const isSizeKey = (key: FilterKey): key is (typeof SIZE_KEYS)[number] =>
  SIZE_KEYS.includes(key as (typeof SIZE_KEYS)[number]);
const isTimeKey = (key: FilterKey): key is (typeof TIME_KEYS)[number] =>
  TIME_KEYS.includes(key as (typeof TIME_KEYS)[number]);

const getRowError = (row: FilterRow): string | undefined => {
  const value = row.value.trim();
  if (!value) return undefined;

  if (isSizeKey(row.key) && !/^-?\d+$/.test(value)) {
    return "Size must be an integer (Java long).";
  }

  if (isTimeKey(row.key) && Number.isNaN(Date.parse(value))) {
    return "Invalid date/time. Use a parseable format (e.g. 2026-03-21T10:30:00Z).";
  }

  return undefined;
};

function SearchBar({ onQueryChange }: SearchBarProps) {
  const [rows, setRows] = useState<FilterRow[]>([
    { id: 1, key: "fileName", value: "" },
  ]);

  const rowErrors = useMemo(() => {
    const errors: Record<number, string | undefined> = {};
    rows.forEach((row) => {
      errors[row.id] = getRowError(row);
    });
    return errors;
  }, [rows]);

  const builtQuery = useMemo(
    () =>
      rows
        .filter((row) => !rowErrors[row.id])
        .map((row) => `${row.key}:${row.value.trim()}`)
        .filter((entry) => !entry.endsWith(":"))
        .join(";"),
    [rowErrors, rows],
  );

  useEffect(() => {
    onQueryChange(builtQuery);
  }, [builtQuery, onQueryChange]);

  const addRow = () => {
    setRows((current) => [
      ...current,
      { id: Date.now(), key: "fileName", value: "" },
    ]);
  };

  const updateRow = (id: number, next: Partial<FilterRow>) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...next } : row)),
    );
  };

  const removeRow = (id: number) => {
    setRows((current) => current.filter((row) => row.id !== id));
  };

  const clearAll = () => {
    setRows([{ id: Date.now(), key: "fileName", value: "" }]);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg shadow-slate-950/40">
      <label className="mb-2 block text-sm text-slate-300">Search filters</label>
      <p className="mb-3 text-xs text-slate-400">
        You can only use allowed fields from your parser configuration.
      </p>

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id}>
            <div className="flex items-center gap-3">
              <select
                value={row.key}
                onChange={(event) =>
                  updateRow(row.id, { key: event.target.value as FilterKey })
                }
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
              >
                {FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={row.value}
                onChange={(event) => updateRow(row.id, { value: event.target.value })}
                placeholder="Enter value..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
              />

              <button
                type="button"
                onClick={() => removeRow(row.id)}
                disabled={rows.length === 1}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Remove
              </button>
            </div>

            {rowErrors[row.id] ? (
              <p className="mt-1 text-xs text-red-300">{rowErrors[row.id]}</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
        >
          Add filter
        </button>

        <button
          type="button"
          onClick={clearAll}
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
        >
          Clear all
        </button>
      </div>
    </div>
  );
}

export default SearchBar;
