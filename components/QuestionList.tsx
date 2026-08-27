"use client";

import { useMemo, useState } from "react";
import type { MappedItem } from "@/lib/types";
import { IconChevronDown } from "@/components/icons";
import { ConfidenceBadge } from "@/components/Badges";

function scoreTone(score: number, max: number): "success" | "warn" | "danger" {
  if (max <= 0) return "warn";
  if (score >= max) return "success";
  if (score <= 0) return "danger";
  return "warn";
}

function ScorePill({ item }: { item: MappedItem }) {
  if (item.status === "unanswered") {
    return (
      <span className="whitespace-nowrap rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold text-black/40">
        Not answered
      </span>
    );
  }
  if (item.status === "unmatched") {
    return (
      <span className="whitespace-nowrap rounded-full bg-fuchsia-50 px-2.5 py-1 text-xs font-semibold text-fuchsia-600 ring-1 ring-inset ring-fuchsia-200">
        Unmatched
      </span>
    );
  }
  if (!item.grading) {
    return (
      <span className="whitespace-nowrap rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold text-black/30">
        Grading…
      </span>
    );
  }
  const tone = scoreTone(item.grading.score, item.grading.maxMarks);
  const classes = {
    success: "bg-success-light text-success",
    warn: "bg-warn-light text-warn",
    danger: "bg-danger-light text-danger",
  }[tone];
  const isAssumed = item.grading.marksSource === "assumed";
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${classes}`}
      title={
        isAssumed
          ? "This question paper didn't print marks for this question — graded out of an assumed 10."
          : undefined
      }
    >
      {item.grading.score}/{item.grading.maxMarks}
      {isAssumed && <sup className="ml-0.5 font-bold">*</sup>}
    </span>
  );
}

function Badge({ item }: { item: MappedItem }) {
  const label = item.question
    ? item.question.subpart ?? item.question.number
    : item.answer?.subpart ?? item.answer?.questionNumber ?? "?";
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
      {label}
    </span>
  );
}

function Row({
  item,
  expanded,
  selected,
  onToggle,
}: {
  item: MappedItem;
  expanded: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const text = item.question?.text ?? item.answer?.transcribedText ?? "";

  return (
    <div
      className={`rounded-xl border transition-colors ${
        selected ? "border-accent/40 bg-accent-light/25" : "border-transparent hover:bg-black/[0.03]"
      }`}
    >
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 px-3 py-3 text-left">
        <Badge item={item} />
        <p className={`min-w-0 flex-1 text-sm text-ink ${expanded ? "" : "line-clamp-2"}`}>{text}</p>
        <div className="flex shrink-0 items-center gap-2">
          {item.answer && <ConfidenceBadge confidence={item.answer.confidence} compact />}
          <ScorePill item={item} />
          <IconChevronDown
            className={`h-4 w-4 text-black/30 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 px-3 pb-3 pl-[3.25rem]">
          {item.answer && <ConfidenceBadge confidence={item.answer.confidence} />}
          {item.grading?.marksSource === "assumed" && (
            <span
              className="inline-flex w-fit items-center gap-1 rounded-full bg-warn-light px-2 py-0.5 text-[11px] font-semibold text-warn"
              title="This question paper didn't print marks for this question."
            >
              * Assumed out of 10 — not printed on the question paper
            </span>
          )}
          {item.status === "unanswered" && (
            <p className="rounded-lg bg-black/5 px-3 py-2 text-xs text-black/50">
              No answer was detected for this question on the answer sheet.
            </p>
          )}
          {item.grading && item.status !== "unanswered" && (
            <div className="rounded-lg border-l-2 border-accent bg-accent-light/30 px-3 py-2">
              <p className="text-xs font-bold text-ink">AI Feedback</p>
              <p className="mt-0.5 text-xs text-ink/70">{item.grading.feedback}</p>
            </div>
          )}
          {item.answer && item.answer.regions.length > 1 && (
            <span className="mt-2 inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
              Spans {item.answer.regions.length} pages
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function QuestionList({
  mapping,
  selectedId,
  onSelect,
}: {
  mapping: MappedItem[];
  selectedId: string | null;
  onSelect: (item: MappedItem) => void;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { matched, unmatched } = useMemo(
    () => ({
      matched: mapping.filter((m) => m.status !== "unmatched"),
      unmatched: mapping.filter((m) => m.status === "unmatched"),
    }),
    [mapping]
  );

  const allExpanded = mapping.length > 0 && expandedIds.size === mapping.length;

  const toggleExpandAll = () => {
    setExpandedIds(allExpanded ? new Set() : new Set(mapping.map((m) => m.id)));
  };

  const handleToggle = (item: MappedItem) => {
    onSelect(item);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  if (mapping.length === 0) {
    return <p className="p-4 text-sm text-black/40">No questions extracted.</p>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
        <h2 className="text-sm font-bold text-ink">Extracted Questions (from question paper)</h2>
        <button
          type="button"
          onClick={toggleExpandAll}
          className="shrink-0 rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-ink/70 hover:bg-black/5"
        >
          {allExpanded ? "Collapse All" : "Expand All"}
        </button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-2 py-2 scrollbar-thin">
        {matched.map((item) => (
          <Row
            key={item.id}
            item={item}
            expanded={expandedIds.has(item.id)}
            selected={item.id === selectedId}
            onToggle={() => handleToggle(item)}
          />
        ))}

        {unmatched.length > 0 && (
          <div className="mt-3 border-t border-black/5 pt-3">
            <div className="px-2 pb-2">
              <p className="text-xs font-bold uppercase tracking-wide text-fuchsia-500">Unmatched Answers</p>
              <p className="text-xs text-black/40">Handwriting references a question number not found in the paper.</p>
            </div>
            <div className="space-y-1">
              {unmatched.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  expanded={expandedIds.has(item.id)}
                  selected={item.id === selectedId}
                  onToggle={() => handleToggle(item)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
