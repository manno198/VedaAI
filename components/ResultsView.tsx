"use client";

import { useState } from "react";
import type { MappedItem, PageImage, GradingSummary } from "@/lib/types";
import { QuestionList } from "./QuestionList";
import { AnswerViewer } from "./AnswerViewer";
import { SummaryCard } from "./SummaryCard";

type MobileTab = "questions" | "answers";

export function ResultsView({
  mapping,
  answerPages,
  summary,
}: {
  mapping: MappedItem[];
  answerPages: PageImage[];
  summary: GradingSummary | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("questions");
  const selectedItem = mapping.find((m) => m.id === selectedId) ?? null;

  const select = (item: MappedItem) => {
    setSelectedId(item.id);
    setMobileTab("answers");
  };

  return (
    <div className="flex h-full flex-col p-3 sm:p-5">
      {summary && (
        <div className="mb-4 shrink-0 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
          <SummaryCard summary={summary} />
        </div>
      )}

      <div className="mb-3 shrink-0 lg:hidden">
        <div className="inline-flex rounded-full bg-black/5 p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setMobileTab("questions")}
            className={`rounded-full px-4 py-1.5 transition-colors ${
              mobileTab === "questions" ? "bg-ink text-white" : "text-black/50"
            }`}
          >
            Questions
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("answers")}
            className={`rounded-full px-4 py-1.5 transition-colors ${
              mobileTab === "answers" ? "bg-ink text-white" : "text-black/50"
            }`}
          >
            Answer Sheet
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
        <div
          className={`min-h-0 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm lg:block ${
            mobileTab === "questions" ? "block" : "hidden"
          }`}
        >
          <QuestionList mapping={mapping} selectedId={selectedId} onSelect={select} />
        </div>
        <div
          className={`min-h-0 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm lg:block ${
            mobileTab === "answers" ? "block" : "hidden"
          }`}
        >
          <AnswerViewer answerPages={answerPages} selectedItem={selectedItem} />
        </div>
      </div>
    </div>
  );
}
