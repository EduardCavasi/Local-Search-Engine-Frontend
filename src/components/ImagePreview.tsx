import { useEffect, useState } from "react";
import { retrieveImage } from "../api";

type ImagePreviewProps = {
  filePath: string;
  fileName: string;
  className?: string;
};

export function fileNameFromPath(filePath: string): string {
  const parts = filePath.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || filePath;
}

export default function ImagePreview({ filePath, fileName, className }: ImagePreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let activeUrl: string | null = null;
    setObjectUrl(null);
    setError(null);

    void retrieveImage(filePath, controller.signal)
      .then((blob) => {
        activeUrl = URL.createObjectURL(blob);
        setObjectUrl(activeUrl);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load image.");
      });

    return () => {
      controller.abort();
      if (activeUrl) URL.revokeObjectURL(activeUrl);
    };
  }, [filePath]);

  if (error) {
    return <p className="mt-2 text-xs text-red-300">{error}</p>;
  }
  if (!objectUrl) {
    return <p className="mt-2 text-xs text-slate-500">Loading image…</p>;
  }
  return (
    <img
      src={objectUrl}
      alt={fileName}
      className={
        className ??
        "app-scrollbar mt-2 max-h-96 max-w-full rounded border border-slate-800 object-contain"
      }
    />
  );
}
