"use client";

import * as React from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  FileWarning,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  X,
} from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

/**
 * Served from `public/` rather than a CDN: the app runs behind a login on
 * networks that may not reach one, and a viewer that silently fails to load
 * its worker shows an empty box with no explanation.
 */
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

/** Loaded once and shared, so every Document does not re-fetch the tables. */
const PDF_OPTIONS = {
  cMapUrl: "/pdf-cmaps/",
  standardFontDataUrl: "/pdf-fonts/",
} as const;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const STEP = 0.15;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));
}

/**
 * The pages, stacked and scrolled.
 *
 * Split out so the panel and the fullscreen dialog render the same thing at
 * different sizes rather than keeping two viewers in step by hand.
 */
function Pages({
  url,
  zoom,
  onPages,
  onVisiblePage,
  onFailed,
  /**
   * How wide a page may get before it stops being easier to read.
   *
   * Fullscreen otherwise renders an A4 page across the whole monitor, where a
   * line of body text is a foot long and the eye loses its place returning to
   * the left margin. Zooming past this is still allowed - it is a ceiling on
   * the default, not on the reader.
   */
  maxWidth = Infinity,
}: {
  url: string;
  zoom: number;
  onPages: (count: number) => void;
  onVisiblePage: (page: number) => void;
  onFailed: () => void;
  maxWidth?: number;
}) {
  const [pages, setPages] = React.useState(0);
  const [width, setWidth] = React.useState(0);
  const frameRef = React.useRef<HTMLDivElement | null>(null);
  const pageRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  // A page is drawn to a bitmap, so it needs a pixel width rather than a
  // percentage. Watching the container keeps it right through a sidebar
  // collapse, a window resize, or the jump into fullscreen.
  React.useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Which page the reader is actually looking at, so the counter follows the
  // scroll rather than a button nobody pressed.
  React.useEffect(() => {
    if (pages === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (top) onVisiblePage(Number(top.target.getAttribute("data-page")));
      },
      { root: frameRef.current, threshold: [0.25, 0.5, 0.75] },
    );
    for (const node of pageRefs.current) if (node) observer.observe(node);
    return () => observer.disconnect();
  }, [pages, onVisiblePage]);

  const pageWidth = Math.max(240, Math.min(width - 32, maxWidth) * zoom);

  return (
    <div ref={frameRef} className="scrollbar-thin h-full overflow-auto p-4">
      <Document
        file={url}
        options={PDF_OPTIONS}
        onLoadSuccess={({ numPages }) => {
          setPages(numPages);
          onPages(numPages);
        }}
        onLoadError={onFailed}
        onSourceError={onFailed}
        loading={
          <div className="flex h-80 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        }
        error={null}
        className="flex flex-col items-center gap-4"
      >
        {width > 0
          ? Array.from({ length: pages }, (_, index) => (
              <div
                key={index}
                data-page={index + 1}
                ref={(node) => {
                  pageRefs.current[index] = node;
                }}
              >
                <Page
                  pageNumber={index + 1}
                  width={pageWidth}
                  renderAnnotationLayer
                  renderTextLayer
                  className={cn(
                    "overflow-hidden rounded-lg shadow-sm ring-1 ring-border",
                    "[&>canvas]:!h-auto [&>canvas]:!max-w-full",
                  )}
                  loading={
                    <div
                      className="animate-pulse rounded-lg bg-muted"
                      style={{
                        width: pageWidth,
                        // A4's ratio, so the placeholder is the size the page
                        // will be and the scroll position does not jump when
                        // it arrives.
                        height: pageWidth * 1.414,
                      }}
                    />
                  }
                />
              </div>
            ))
          : null}
      </Document>
    </div>
  );
}

/**
 * A PDF, rendered by the app rather than by the browser.
 *
 * An `<iframe>` showed Chrome's own viewer: a dark toolbar with its own
 * typography, its own icons and a sidebar, sitting inside a light panel and
 * looking like a different program pasted into the page. It also differs
 * between browsers, so nobody could be shown the same thing twice.
 */
export function PdfViewer({
  url,
  title,
  className,
}: {
  url: string;
  title: string;
  className?: string;
}) {
  const [pages, setPages] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [zoom, setZoom] = React.useState(1);
  const [full, setFull] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const onPages = React.useCallback((count: number) => setPages(count), []);
  const onVisiblePage = React.useCallback((next: number) => setPage(next), []);
  const onFailed = React.useCallback(() => setFailed(true), []);

  // Escape leaves fullscreen, the way every other overlay in the app behaves.
  React.useEffect(() => {
    if (!full) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFull(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  if (failed) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-10 text-center",
          className,
        )}
      >
        <FileWarning className="size-6 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">This file could not be shown</p>
          <p className="mt-1 text-sm text-muted-foreground">
            It may not be a PDF. Downloading it should still work.
          </p>
        </div>
      </div>
    );
  }

  const toolbar = (
    <div className="flex items-center gap-1 border-b border-border bg-card px-2 py-1.5">
      <span className="min-w-20 px-2 text-xs tabular-nums text-muted-foreground">
        {pages ? `Page ${page} of ${pages}` : "Loading…"}
      </span>

      <span className="mx-1 h-5 w-px bg-border" />

      <IconButton
        size="sm"
        label="Zoom out"
        icon={<Minus />}
        disabled={zoom <= MIN_ZOOM}
        onClick={() => setZoom((z) => clampZoom(z - STEP))}
      />
      <span className="min-w-12 text-center text-xs tabular-nums text-muted-foreground">
        {Math.round(zoom * 100)}%
      </span>
      <IconButton
        size="sm"
        label="Zoom in"
        icon={<Plus />}
        disabled={zoom >= MAX_ZOOM}
        onClick={() => setZoom((z) => clampZoom(z + STEP))}
      />
      {zoom !== 1 ? (
        <button
          type="button"
          onClick={() => setZoom(1)}
          className="rounded px-2 py-1 text-xs text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          Reset
        </button>
      ) : null}

      <span className="ml-auto" />
      <IconButton
        size="sm"
        label={full ? "Leave full screen" : "Full screen"}
        icon={full ? <X /> : <Maximize2 />}
        onClick={() => setFull((value) => !value)}
      />
    </div>
  );

  return (
    <>
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-xl border border-border bg-muted/30",
          className,
        )}
      >
        {toolbar}
        <div className="h-[68vh] min-h-96">
          {!full ? (
            <Pages
              url={url}
              zoom={zoom}
              onPages={onPages}
              onVisiblePage={onVisiblePage}
              onFailed={onFailed}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Open in full screen
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen is its own layer rather than a bigger panel: a contract is
          read, and reading is what the rest of the screen is competing with. */}
      {full ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/98 backdrop-blur-sm">
          <div className="flex items-center gap-3 border-b border-border px-4 py-2">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">
              {title}
            </p>
          </div>
          <div className="border-b border-border">{toolbar}</div>
          <div className="min-h-0 flex-1">
            <Pages
              url={url}
              zoom={zoom}
              maxWidth={900}
              onPages={onPages}
              onVisiblePage={onVisiblePage}
              onFailed={onFailed}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
