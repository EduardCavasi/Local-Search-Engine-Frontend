import { useEffect, useState, type ReactNode } from "react";
import type { WidgetPayload, WidgetType } from "../../api";
import AnalyzeLogsPanel from "./AnalyzeLogsPanel";
import EntityExtractionPanel from "./EntityExtractionPanel";
import ImageGalleryPanel from "./ImageGalleryPanel";

const WIDGET_META: Record<
  WidgetType,
  {
    label: string;
    title: string;
    description: string;
    buttonClass: string;
  }
> = {
  ENTITY_EXTRACTION: {
    label: "Entities",
    title: "Entity extraction",
    description: "Emails, IP addresses and URLs found across textual results.",
    buttonClass:
      "border-violet-700/80 bg-violet-950/40 text-violet-200 hover:border-violet-500 hover:text-violet-100",
  },
  ANALYZE_LOGS: {
    label: "Analyze logs",
    title: "Log analysis",
    description: "Error, warning and info counts plus top exceptions across log files.",
    buttonClass:
      "border-amber-700/80 bg-amber-950/40 text-amber-200 hover:border-amber-500 hover:text-amber-100",
  },
  IMAGE_GALLERY: {
    label: "Gallery",
    title: "Image gallery",
    description: "Preview all image results from this search.",
    buttonClass:
      "border-emerald-700/80 bg-emerald-950/40 text-emerald-200 hover:border-emerald-500 hover:text-emerald-100",
  },
};

function renderPanel(payload: WidgetPayload) {
  switch (payload.widget_type) {
    case "ENTITY_EXTRACTION":
      return <EntityExtractionPanel payload={payload} />;
    case "ANALYZE_LOGS":
      return <AnalyzeLogsPanel payload={payload} />;
    case "IMAGE_GALLERY":
      return <ImageGalleryPanel payload={payload} />;
  }
}

type WidgetActionButtonsProps = {
  widgetPayloads: WidgetPayload[];
  openType: WidgetType | null;
  onToggle: (type: WidgetType) => void;
};

export function WidgetActionButtons({
  widgetPayloads,
  openType,
  onToggle,
}: WidgetActionButtonsProps) {
  if (widgetPayloads.length === 0) return null;

  return (
    <>
      <span className="hidden h-6 w-px bg-slate-700 sm:block" aria-hidden />
      {widgetPayloads.map((widget) => {
        const meta = WIDGET_META[widget.widget_type];
        const isOpen = openType === widget.widget_type;
        return (
          <button
            key={widget.widget_type}
            type="button"
            onClick={() => onToggle(widget.widget_type)}
            className={`rounded-lg border px-3 py-2 text-sm transition ${meta.buttonClass} ${
              isOpen ? "ring-2 ring-white/15" : ""
            }`}
          >
            {meta.label}
          </button>
        );
      })}
    </>
  );
}

type WidgetPopupOverlayProps = {
  widgetPayloads: WidgetPayload[];
  openType: WidgetType | null;
  onClose: () => void;
};

export function WidgetPopupOverlay({
  widgetPayloads,
  openType,
  onClose,
}: WidgetPopupOverlayProps) {
  const openPayload = widgetPayloads.find((w) => w.widget_type === openType);
  const openMeta = openType ? WIDGET_META[openType] : null;

  if (!openType || !openPayload || !openMeta) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label={`Close ${openMeta.title}`}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
      />

      <div className="absolute bottom-24 right-6 flex h-[min(42rem,calc(100vh-8rem))] w-[min(32rem,calc(100vw-3rem))] flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/95 shadow-2xl">
        <div className="border-b border-slate-800 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Context widget
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-50">{openMeta.title}</h2>
              <p className="mt-1 text-sm text-slate-400">{openMeta.description}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>

        <div className="app-scrollbar flex-1 overflow-y-auto px-5 py-4">
          {renderPanel(openPayload)}
        </div>
      </div>
    </div>
  );
}

export function useWidgetPopups(widgetPayloads: WidgetPayload[]) {
  const [openType, setOpenType] = useState<WidgetType | null>(null);

  useEffect(() => {
    if (openType && !widgetPayloads.some((w) => w.widget_type === openType)) {
      setOpenType(null);
    }
  }, [widgetPayloads, openType]);

  const toggle = (type: WidgetType) => {
    setOpenType((current) => (current === type ? null : type));
  };

  const close = () => setOpenType(null);

  const actionButtons: ReactNode =
    widgetPayloads.length > 0 ? (
      <WidgetActionButtons
        widgetPayloads={widgetPayloads}
        openType={openType}
        onToggle={toggle}
      />
    ) : null;

  const overlay = (
    <WidgetPopupOverlay
      widgetPayloads={widgetPayloads}
      openType={openType}
      onClose={close}
    />
  );

  return { actionButtons, overlay, openType };
}
