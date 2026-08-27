export function ConfidenceBadge({ confidence, compact }: { confidence: number; compact?: boolean }) {
  const low = confidence < 0.55;
  const mid = confidence >= 0.55 && confidence < 0.8;
  const classes = low
    ? "bg-warn-light text-warn"
    : mid
    ? "bg-black/5 text-black/50"
    : "bg-success-light text-success";

  if (compact && !low) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${classes}`}
      title={`Transcription confidence: ${Math.round(confidence * 100)}%`}
    >
      {low && (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 8a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {low ? "AI unsure" : `${Math.round(confidence * 100)}% confident`}
    </span>
  );
}
