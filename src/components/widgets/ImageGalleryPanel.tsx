import type { ImageGalleryPayload } from "../../api";
import ImagePreview, { fileNameFromPath } from "../ImagePreview";

type ImageGalleryPanelProps = {
  payload: ImageGalleryPayload;
};

export default function ImageGalleryPanel({ payload }: ImageGalleryPanelProps) {
  return (
    <div>
      <p className="text-xs text-slate-400">{payload.nr_images} images in gallery</p>
      <div className="app-scrollbar mt-3 grid max-h-[28rem] grid-cols-2 gap-3 overflow-auto sm:grid-cols-3">
        {payload.images.map((path) => {
          const name = fileNameFromPath(path);
          return (
            <figure
              key={path}
              className="rounded-lg border border-slate-800 bg-slate-950/50 p-2"
            >
              <ImagePreview
                filePath={path}
                fileName={name}
                className="mx-auto max-h-40 w-full rounded object-contain"
              />
              <figcaption className="mt-1 truncate text-center text-[10px] text-slate-500">
                {name}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
