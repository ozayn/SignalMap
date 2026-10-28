"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { ExportChartModal } from "@/components/export-chart-modal";
import { DEFAULT_EXPORT_CHART_FONT_SIZES, type ExportChartSettings } from "@/lib/chart-export-presentation";
import { chartImagesZip } from "@/lib/chart-export-zip";
import { slugifyChartFilename } from "@/lib/chart-export";

type Capture = (settings: ExportChartSettings) => Promise<{ filename: string; dataUrl: string }>;
const Context = createContext<{ register: (id: string, capture: Capture) => () => void } | null>(null);

export function StudyBatchExportProvider({ children, studySlug, locale }: { children: ReactNode; studySlug: string; locale: "en" | "fa" }) {
  const captures = useRef(new Map<string, Capture>());
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const register = useCallback((id: string, capture: Capture) => {
    captures.current.set(id, capture); setCount(captures.current.size);
    return () => { if (captures.current.get(id) === capture) captures.current.delete(id); setCount(captures.current.size); };
  }, []);
  const context = useMemo(() => ({ register }), [register]);
  const download = async (settings: ExportChartSettings) => {
    setOpen(false); setError(null);
    const entries = [...captures.current.entries()].sort(([a], [b]) => {
      const left = document.getElementById(a);
      const right = document.getElementById(b);
      if (!left || !right) return 0;
      return left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    }).map(([, capture]) => capture);
    try {
      if (!entries.length) throw new Error("No charts are ready to export.");
      const files: Array<{ name: string; bytes: Uint8Array }> = [];
      for (let i = 0; i < entries.length; i++) {
        setProgress(`Exporting ${i + 1} of ${entries.length}…`);
        const image = await entries[i](settings);
        const raw = atob(image.dataUrl.split(",")[1]);
        files.push({ name: `${String(i + 1).padStart(2, "0")}-${image.filename}`, bytes: Uint8Array.from(raw, c => c.charCodeAt(0)) });
      }
      const url = URL.createObjectURL(chartImagesZip(files));
      const link = document.createElement("a"); link.href = url;
      link.download = `${slugifyChartFilename(studySlug)}-${locale}-${settings.fontPreset}-charts.zip`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chart export failed. Please try again.");
    } finally { setProgress(null); }
  };
  return <Context.Provider value={context}>
    <div className="flex flex-wrap items-center gap-2 text-xs" dir="ltr">
      <button type="button" className="rounded-md border border-border bg-background px-3 py-2 hover:bg-muted disabled:opacity-50" disabled={count === 0 || progress !== null} onClick={() => { setError(null); setOpen(true); }}>
        {progress ?? `Download all charts (${count})`}
      </button>
      {error && <span role="alert" className="text-destructive">{error}</span>}
    </div>
    <ExportChartModal open={open} onClose={() => setOpen(false)} defaultTitle="" defaultFontSizes={DEFAULT_EXPORT_CHART_FONT_SIZES} onExport={download} batch />
    {children}
  </Context.Provider>;
}
export function useStudyBatchExport() { return useContext(Context); }
