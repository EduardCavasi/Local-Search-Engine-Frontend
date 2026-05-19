import type { EntityExtractionPayload } from "../../api";

type EntityExtractionPanelProps = {
  payload: EntityExtractionPayload;
};

function StatBlock({ label, count, values }: { label: string; count: number; values: string[] }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-cyan-200">{count}</p>
      {values.length > 0 ? (
        <ul className="app-scrollbar mt-2 max-h-32 space-y-1 overflow-auto text-xs text-slate-300">
          {values.map((value) => (
            <li key={value} className="break-all font-mono">
              {value}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-slate-500">None found</p>
      )}
    </div>
  );
}

export default function EntityExtractionPanel({ payload }: EntityExtractionPanelProps) {
  const { stats } = payload;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <StatBlock label="Emails" count={stats.emails.count} values={stats.emails.values} />
      <StatBlock
        label="IP addresses"
        count={stats.ip_addresses.count}
        values={stats.ip_addresses.values}
      />
      <StatBlock label="URLs" count={stats.urls.count} values={stats.urls.values} />
    </div>
  );
}
