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
  { value: "created>", label: "Created >" },
  { value: "created<", label: "Created <" },
] as const;
const SIZE_KEYS = ["size>", "size<"] as const;
const TIME_KEYS = [
  "lastModified>",
  "lastModified<",
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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Current UTC date/time as `DD.MM.YYYY HH:mm:ss` (defaults for new time filters). */
function formatNowUtcDateTime(): string {
  const n = new Date();
  return `${pad2(n.getUTCDate())}.${pad2(n.getUTCMonth() + 1)}.${n.getUTCFullYear()} ${pad2(n.getUTCHours())}:${pad2(n.getUTCMinutes())}:${pad2(n.getUTCSeconds())}`;
}

/**
 * Parse `DD.MM.YYYY HH:mm:ss` or `DD.MM.YYYY` (time defaults to 00:00:00).
 * Values are **UTC** wall-clock (matches `…Z` ISO strings).
 */
function parseUtcDateTime(raw: string): {
  d: number;
  m: number;
  y: number;
  h: number;
  mi: number;
  s: number;
} | null {
  const t = raw.trim();
  const re =
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?$/;
  const match = re.exec(t);
  if (!match) return null;
  const d = Number.parseInt(match[1], 10);
  const m = Number.parseInt(match[2], 10);
  const y = Number.parseInt(match[3], 10);
  const h = match[4] !== undefined ? Number.parseInt(match[4], 10) : 0;
  const mi = match[5] !== undefined ? Number.parseInt(match[5], 10) : 0;
  const s = match[6] !== undefined ? Number.parseInt(match[6], 10) : 0;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (h < 0 || h > 23 || mi < 0 || mi > 59 || s < 0 || s > 59) return null;
  const test = new Date(Date.UTC(y, m - 1, d, h, mi, s));
  if (test.getUTCFullYear() !== y || test.getUTCMonth() !== m - 1 || test.getUTCDate() !== d) {
    return null;
  }
  if (
    test.getUTCHours() !== h ||
    test.getUTCMinutes() !== mi ||
    test.getUTCSeconds() !== s
  ) {
    return null;
  }
  return { d, m, y, h, mi, s };
}

function utcDateTimeToIso(raw: string): string | null {
  const p = parseUtcDateTime(raw);
  if (!p) return null;
  const t = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return new Date(t).toISOString();
}

function splitDottedDate(value: string): [string, string, string] {
  const dateSegment = value.trim().split(/\s+/)[0] ?? "";
  const parts = dateSegment.split(".");
  if (parts.length === 3) {
    return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
  }
  return ["", "", ""];
}

function splitTimeParts(value: string): [string, string, string] {
  const t = value.trim();
  const space = t.indexOf(" ");
  if (space === -1) return ["", "", ""];
  const timePart = t.slice(space + 1).trim();
  const seg = timePart.split(":");
  return [seg[0] ?? "", seg[1] ?? "", seg[2] ?? ""];
}

function joinDateTime(
  day: string,
  month: string,
  year: string,
  hour: string,
  minute: string,
  second: string,
): string {
  const d = day.trim();
  const mo = month.trim();
  const y = year.trim();
  const h = hour.trim();
  const mi = minute.trim();
  const s = second.trim();
  if (!d && !mo && !y && !h && !mi && !s) return "";
  const padPair = (v: string) => {
    if (!v) return v;
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? v : pad2(n);
  };
  const dateStr = `${padPair(d)}.${padPair(mo)}.${y}`;
  if (!h && !mi && !s) return dateStr;
  return `${dateStr} ${padPair(h)}:${padPair(mi)}:${padPair(s)}`;
}

function getRowError(row: FilterRow): string | undefined {
  const value = row.value.trim();
  if (!value) return undefined;

  if (isSizeKey(row.key) && !/^-?\d+$/.test(value)) {
    return "Size must be an integer (Java long).";
  }

  if (isTimeKey(row.key)) {
    if (!parseUtcDateTime(value)) {
      return "Use UTC date/time: DD.MM.YYYY HH:mm:ss (e.g. 21.03.2026 14:30:00).";
    }
    if (!utcDateTimeToIso(value)) {
      return "Invalid date or time.";
    }
  }

  return undefined;
}

function encodeRowValue(row: FilterRow): string {
  const trimmed = row.value.trim();
  if (!trimmed) return "";
  if (isTimeKey(row.key)) {
    const iso = utcDateTimeToIso(trimmed);
    return iso ?? trimmed;
  }
  return trimmed;
}

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
        .map((row) => {
          const encoded = encodeRowValue(row);
          if (!encoded) return null;
          return `${row.key}:${encoded}`;
        })
        .filter((entry): entry is string => entry !== null)
        .join(";"),
    [rowErrors, rows],
  );

  useEffect(() => {
    onQueryChange(builtQuery);
  }, [builtQuery, onQueryChange]);

  const emptyTimeRowIds = useMemo(
    () =>
      rows
        .filter((r) => isTimeKey(r.key) && !r.value.trim())
        .map((r) => r.id)
        .join(","),
    [rows],
  );

  /** Fill default "now" when a time row is empty (e.g. user cleared fields). */
  useEffect(() => {
    if (!emptyTimeRowIds) return;
    setRows((prev) => {
      let changed = false;
      const next = prev.map((row) => {
        if (isTimeKey(row.key) && !row.value.trim()) {
          changed = true;
          return { ...row, value: formatNowUtcDateTime() };
        }
        return row;
      });
      return changed ? next : prev;
    });
  }, [emptyTimeRowIds]);

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

  const updateTimeField = (
    id: number,
    part: "day" | "month" | "year" | "hour" | "minute" | "second",
    next: string,
  ) => {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== id) return row;
        const [d, m, y] = splitDottedDate(row.value);
        const [h, mi, s] = splitTimeParts(row.value);
        return {
          ...row,
          value: joinDateTime(
            part === "day" ? next : d,
            part === "month" ? next : m,
            part === "year" ? next : y,
            part === "hour" ? next : h,
            part === "minute" ? next : mi,
            part === "second" ? next : s,
          ),
        };
      }),
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
      <label className="mb-2 block text-sm text-slate-300"><b>Search filters</b></label>
      <div className="space-y-3">
        {rows.map((row) => {
          const [day, month, year] = splitDottedDate(row.value);
          const [hour, minute, second] = splitTimeParts(row.value);
          const showTimeInputs = isTimeKey(row.key);

          return (
            <div key={row.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
                <select
                  value={row.key}
                  onChange={(event) => {
                    const nextKey = event.target.value as FilterKey;
                    const wasTime = isTimeKey(row.key);
                    const willBeTime = isTimeKey(nextKey);
                    let nextValue = row.value;
                    if (willBeTime && !wasTime) nextValue = formatNowUtcDateTime();
                    if (!willBeTime && wasTime) nextValue = "";
                    updateRow(row.id, { key: nextKey, value: nextValue });
                  }}
                  className="min-w-[11rem] shrink-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
                >
                  {FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                {showTimeInputs ? (
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-20 shrink-0 text-xs font-medium text-slate-400">
                        Date (UTC)
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="sr-only" htmlFor={`day-${row.id}`}>
                          Day
                        </label>
                        <input
                          id={`day-${row.id}`}
                          type="number"
                          min={1}
                          max={31}
                          inputMode="numeric"
                          placeholder="DD"
                          value={day}
                          onChange={(e) => updateTimeField(row.id, "day", e.target.value)}
                          className="w-14 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-center text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
                        />
                        <span className="text-slate-500">.</span>
                        <label className="sr-only" htmlFor={`month-${row.id}`}>
                          Month
                        </label>
                        <input
                          id={`month-${row.id}`}
                          type="number"
                          min={1}
                          max={12}
                          inputMode="numeric"
                          placeholder="MM"
                          value={month}
                          onChange={(e) => updateTimeField(row.id, "month", e.target.value)}
                          className="w-14 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-center text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
                        />
                        <span className="text-slate-500">.</span>
                        <label className="sr-only" htmlFor={`year-${row.id}`}>
                          Year
                        </label>
                        <input
                          id={`year-${row.id}`}
                          type="number"
                          min={1970}
                          max={2100}
                          inputMode="numeric"
                          placeholder="YYYY"
                          value={year}
                          onChange={(e) => updateTimeField(row.id, "year", e.target.value)}
                          className="w-[4.5rem] rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-center text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-20 shrink-0 text-xs font-medium text-slate-400">
                        Time (UTC)
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="sr-only" htmlFor={`hour-${row.id}`}>
                          Hour
                        </label>
                        <input
                          id={`hour-${row.id}`}
                          type="number"
                          min={0}
                          max={23}
                          inputMode="numeric"
                          placeholder="HH"
                          value={hour}
                          onChange={(e) => updateTimeField(row.id, "hour", e.target.value)}
                          className="w-14 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-center text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
                        />
                        <span className="text-slate-500">:</span>
                        <label className="sr-only" htmlFor={`minute-${row.id}`}>
                          Minute
                        </label>
                        <input
                          id={`minute-${row.id}`}
                          type="number"
                          min={0}
                          max={59}
                          inputMode="numeric"
                          placeholder="mm"
                          value={minute}
                          onChange={(e) => updateTimeField(row.id, "minute", e.target.value)}
                          className="w-14 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-center text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
                        />
                        <span className="text-slate-500">:</span>
                        <label className="sr-only" htmlFor={`second-${row.id}`}>
                          Second
                        </label>
                        <input
                          id={`second-${row.id}`}
                          type="number"
                          min={0}
                          max={59}
                          inputMode="numeric"
                          placeholder="ss"
                          value={second}
                          onChange={(e) => updateTimeField(row.id, "second", e.target.value)}
                          className="w-14 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-center text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
                        />
                        <span
                          className="select-none pl-0.5 text-sm font-semibold text-cyan-400"
                          title="UTC — sent as ISO-8601 with Z"
                          aria-hidden
                        >
                          Z
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={row.value}
                    onChange={(event) => updateRow(row.id, { value: event.target.value })}
                    placeholder="Enter value..."
                    className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
                  />
                )}

                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1}
                  className="shrink-0 self-start rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40 sm:self-center"
                >
                  Remove
                </button>
              </div>

              {rowErrors[row.id] ? (
                <p className="mt-1 text-xs text-red-300">{rowErrors[row.id]}</p>
              ) : null}
            </div>
          );
        })}
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
