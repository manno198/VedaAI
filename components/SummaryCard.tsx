import type { GradingSummary } from "@/lib/types";

export function SummaryCard({ summary }: { summary: GradingSummary }) {
  const percentScore =
    summary.totalMaxMarks > 0 ? Math.round((summary.totalScore / summary.totalMaxMarks) * 100) : 0;
  const hasAssumedMarks = summary.assumedMarksCount > 0;

  return (
    <div className="p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          label="Total score"
          value={`${summary.totalScore}/${summary.totalMaxMarks}`}
          accent="text-accent-dark"
          note={hasAssumedMarks ? "*" : undefined}
        />
        <Stat label="Overall %" value={`${percentScore}%`} accent="text-accent-dark" />
        <Stat label="Answered" value={`${summary.answeredCount}/${summary.totalQuestions}`} accent="text-success" />
        <Stat label="% Answered" value={`${summary.percentAnswered}%`} accent="text-success" />

        {summary.weakAreas.length > 0 && (
          <div className="col-span-2 sm:col-span-4">
            <p className="text-xs font-bold uppercase tracking-wide text-black/35">Weak areas</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {summary.weakAreas.map((w) => (
                <span
                  key={w}
                  className="inline-flex items-center rounded-full bg-danger-light px-2.5 py-0.5 text-xs font-semibold text-danger"
                >
                  {w}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {hasAssumedMarks && (
        <p className="mt-3 text-[11px] text-black/40">
          * {summary.assumedMarksCount} question{summary.assumedMarksCount > 1 ? "s" : ""} didn&apos;t print
          marks on the question paper and {summary.assumedMarksCount > 1 ? "were" : "was"} graded out of an
          assumed 10 — included in the total above but not specified by the paper itself.
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  note,
}: {
  label: string;
  value: string;
  accent: string;
  note?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-black/40">{label}</p>
      <p className={`mt-0.5 text-xl font-extrabold ${accent}`}>
        {value}
        {note && <sup className="ml-0.5">{note}</sup>}
      </p>
    </div>
  );
}
