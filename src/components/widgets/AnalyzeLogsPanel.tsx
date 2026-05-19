import type { AnalyzeLogsPayload } from "../../api";
import { fileNameFromPath } from "../ImagePreview";

type AnalyzeLogsPanelProps = {
  payload: AnalyzeLogsPayload;
};

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-cyan-200">{value}</p>
    </div>
  );
}

export default function AnalyzeLogsPanel({ payload }: AnalyzeLogsPanelProps) {
  const { stats, topExceptions, logFiles } = payload;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatPill label="Log files" value={stats.log_count} />
        <StatPill label="Errors" value={stats.error_count} />
        <StatPill label="Warnings" value={stats.warn_count} />
        <StatPill label="Info" value={stats.info_count} />
      </div>

      {topExceptions.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Top exceptions
          </p>
          <ul className="mt-2 space-y-1">
            {topExceptions.map((item) => (
              <li
                key={item.exception}
                className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm"
              >
                <span className="font-mono text-amber-200">{item.exception}</span>
                <span className="text-slate-400">×{item.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {logFiles.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Log files</p>
          <ul className="app-scrollbar mt-2 max-h-28 space-y-1 overflow-auto text-xs text-slate-400">
            {logFiles.map((path) => (
              <li key={path} className="break-all">
                <span className="text-cyan-300/90">{fileNameFromPath(path)}</span>
                <span className="text-slate-600"> — </span>
                {path}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
