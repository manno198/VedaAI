"use client";

import { useEffect, useMemo, useState } from "react";
import type { MappedItem, PageImage } from "@/lib/types";
import { formatQuestionLabel } from "@/lib/format";
import { ConfidenceBadge } from "./Badges";
import { IconBack } from "@/components/icons";

type Region = NonNullable<MappedItem["answer"]>["regions"][number];

function BoxOverlay({
  region,
  tag,
  prevPage,
  nextPage,
  onJumpToPage,
}: {
  region: Region;
  tag: string;
  /** Page number of the region immediately before this one, if this answer continues from an earlier page */
  prevPage: number | null;
  /** Page number of the region immediately after this one, if this answer continues onto a later page */
  nextPage: number | null;
  onJumpToPage: (page: number) => void;
}) {
  if (!region.boundingBox) return null;
  const { x, y, width, height } = region.boundingBox;
  return (
    <div
      className="absolute rounded-lg border-2 border-success bg-success/10 shadow-[0_0_0_2000px_rgba(23,23,28,0.12)]"
      style={{ left: `${x / 10}%`, top: `${y / 10}%`, width: `${width / 10}%`, height: `${height / 10}%` }}
    >
      <span className="absolute -top-3 left-0 rounded-md bg-success px-1.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
        {tag}
      </span>

      {prevPage !== null && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onJumpToPage(prevPage);
          }}
          className="pointer-events-auto absolute -top-3 right-0 flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[11px] font-semibold text-success shadow-sm ring-1 ring-inset ring-success hover:bg-success-light"
        >
          ← continued from p.{prevPage}
        </button>
      )}

      {nextPage !== null && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onJumpToPage(nextPage);
          }}
          className="pointer-events-auto absolute -bottom-3 right-0 flex animate-pulse items-center gap-1 rounded-md bg-success px-1.5 py-0.5 text-[11px] font-bold text-white shadow-sm hover:bg-success/90"
        >
          continued on p.{nextPage} →
        </button>
      )}
    </div>
  );
}

export function AnswerViewer({
  answerPages,
  selectedItem,
}: {
  answerPages: PageImage[];
  selectedItem: MappedItem | null;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(100);

  const currentRegions = useMemo(() => {
    if (!selectedItem?.answer) return [];
    return selectedItem.answer.regions.filter((r) => r.page === answerPages[pageIndex]?.page);
  }, [selectedItem, answerPages, pageIndex]);

  useEffect(() => {
    if (!selectedItem?.answer || selectedItem.answer.regions.length === 0) return;
    const firstPage = selectedItem.answer.regions[0].page;
    const idx = answerPages.findIndex((p) => p.page === firstPage);
    if (idx >= 0) setPageIndex(idx);
  }, [selectedItem, answerPages]);

  const jumpToPage = (targetPage: number) => {
    const idx = answerPages.findIndex((p) => p.page === targetPage);
    if (idx >= 0) setPageIndex(idx);
  };

  if (answerPages.length === 0) {
    return <p className="p-4 text-sm text-black/40">No answer sheet pages available.</p>;
  }

  const page = answerPages[pageIndex];
  const answer = selectedItem?.answer ?? null;
  const showNoAnswer = selectedItem && selectedItem.status === "unanswered";
  const tag = selectedItem?.question ? formatQuestionLabel(selectedItem.question) : "?";

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-black/5 px-4 py-3">
        <h2 className="text-sm font-bold text-ink">Answer Sheet</h2>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-full border border-black/10 px-1 py-1 text-xs font-semibold text-ink/70">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-black/5"
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="w-10 text-center tabular-nums">{zoom}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(200, z + 10))}
              className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-black/5"
              aria-label="Zoom in"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-ink/70">
            <button
              type="button"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-black/5 disabled:opacity-30"
              aria-label="Previous page"
            >
              <IconBack className="h-3.5 w-3.5" />
            </button>
            <span>
              Page {page.page} of {answerPages.length}
            </span>
            <button
              type="button"
              disabled={pageIndex === answerPages.length - 1}
              onClick={() => setPageIndex((i) => Math.min(answerPages.length - 1, i + 1))}
              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-black/5 disabled:opacity-30"
              aria-label="Next page"
            >
              <IconBack className="h-3.5 w-3.5 rotate-180" />
            </button>
          </div>
        </div>

        {answer && answer.regions.length > 1 && (
          <div className="mt-2">
            <p className="mb-1 text-[11px] font-semibold text-black/40">
              This answer continues across {answer.regions.length} pages:
            </p>
            <div className="flex items-center gap-1 overflow-x-auto">
              {answer.regions.map((r) => {
                const idx = answerPages.findIndex((p) => p.page === r.page);
                return (
                  <button
                    key={`${r.page}-${idx}`}
                    type="button"
                    onClick={() => setPageIndex(idx)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      idx === pageIndex ? "bg-ink text-white" : "bg-black/5 text-black/50 hover:bg-black/10"
                    }`}
                  >
                    Page {r.page}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="relative flex-1 overflow-auto bg-[#efeee9] p-5">
        <div className="relative mx-auto" style={{ width: `${zoom}%`, maxWidth: zoom <= 100 ? "100%" : "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={page.dataUrl}
            alt={`Answer sheet page ${page.page}`}
            className="block w-full rounded-xl border border-black/5 shadow-sm"
          />
          {currentRegions.map((region, idx) => {
            const globalIdx = answer?.regions.indexOf(region) ?? -1;
            const prevPage =
              answer && globalIdx > 0 ? answer.regions[globalIdx - 1].page : null;
            const nextPage =
              answer && globalIdx >= 0 && globalIdx < answer.regions.length - 1
                ? answer.regions[globalIdx + 1].page
                : null;
            return (
              <BoxOverlay
                key={idx}
                region={region}
                tag={tag}
                prevPage={prevPage}
                nextPage={nextPage}
                onJumpToPage={jumpToPage}
              />
            );
          })}
        </div>
      </div>

      <div className="border-t border-black/5 bg-white px-4 py-3">
        {!selectedItem && (
          <p className="text-sm text-black/40">Select a question on the left to jump to its answer on the sheet.</p>
        )}

        {showNoAnswer && (
          <div className="flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-sm text-black/50">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-black/30">
              <path
                fillRule="evenodd"
                d="M18 10A8 8 0 1 1 2 10a8 8 0 0 1 16 0Zm-8-4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 8a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z"
                clipRule="evenodd"
              />
            </svg>
            No answer detected for {selectedItem?.question ? formatQuestionLabel(selectedItem.question) : "this question"}.
          </div>
        )}

        {selectedItem && answer && (
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-black/40">Transcribed answer</span>
              <ConfidenceBadge confidence={answer.confidence} />
              {!currentRegions.some((r) => r.boundingBox) && (
                <span className="text-xs text-black/30">(region not confidently localized on this page)</span>
              )}
            </div>
            <p className="max-h-28 overflow-y-auto whitespace-pre-wrap text-sm text-ink/80 scrollbar-thin">
              {answer.transcribedText || "(no legible text)"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
