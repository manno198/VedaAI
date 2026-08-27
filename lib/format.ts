import type { Question } from "./types";

export function formatQuestionLabel(q: Pick<Question, "number" | "subpart">): string {
  return q.subpart ? `Q${q.number}(${q.subpart})` : `Q${q.number}`;
}
