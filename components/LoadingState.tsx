import type { StageName, StageStatus } from "@/lib/types";
import { IconSparkle } from "@/components/icons";

export type StageState = Partial<Record<StageName, StageStatus>>;

const STEPS: { stage: StageName; label: string }[] = [
  { stage: "upload", label: "Uploading" },
  { stage: "convert", label: "Converting pages" },
  { stage: "extract-questions", label: "Extracting questions" },
  { stage: "extract-answers", label: "Extracting answers" },
  { stage: "map", label: "Mapping answers" },
  { stage: "grade", label: "Grading" },
  { stage: "done", label: "Finishing up" },
];

function currentStepIndex(stages: StageState): number {
  const active = STEPS.findIndex((s) => stages[s.stage] === "start");
  if (active >= 0) return active;
  for (let i = STEPS.length - 1; i >= 0; i--) {
    if (stages[STEPS[i].stage] === "done") return Math.min(i + 1, STEPS.length - 1);
  }
  return 0;
}

export function LoadingState({ stages }: { stages: StageState }) {
  const idx = currentStepIndex(stages);
  const label = STEPS[idx].label;
  const percent = Math.round(((idx + 1) / STEPS.length) * 100);

  return (
    <div className="flex h-full min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <IconSparkle className="h-14 w-14 animate-pulse text-accent" />
      <h1 className="mt-5 text-xl font-extrabold text-ink">{label}…</h1>
      <p className="mt-1 text-sm text-black/45">This may take a while</p>

      <div className="mt-6 h-1.5 w-64 overflow-hidden rounded-full bg-black/10">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs font-medium text-black/30">
        Step {idx + 1} of {STEPS.length}
      </p>
    </div>
  );
}
