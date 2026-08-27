import type { RawAnswerFragment } from "./schemas";
import type { Answer, AnswerRegion, MappedItem, Question } from "./types";

function normalizeNumber(n: string): string {
  return n
    .trim()
    .replace(/^[Qq]\.?\s*/, "")
    .replace(/[^\w.]/g, "")
    .toLowerCase();
}

function normalizeSubpart(s: string | null | undefined): string | null {
  if (!s) return null;
  const cleaned = s.trim().replace(/[().\s]/g, "").toLowerCase();
  return cleaned || null;
}

function groupKey(number: string, subpart: string | null | undefined): string {
  return `${normalizeNumber(number)}::${normalizeSubpart(subpart) ?? ""}`;
}

/** Strips a leading "Q"/"Q." label for display, without touching casing elsewhere. */
function stripQLabel(n: string): string {
  const stripped = n.trim().replace(/^(?:question|q)\.?\s*/i, "").trim();
  return stripped || n;
}

function buildAnswer(frags: RawAnswerFragment[], idx: number): Answer {
  // Preserve page order within a grouped answer for readability.
  const sorted = [...frags].sort((a, b) => a.page - b.page);
  const regions: AnswerRegion[] = sorted.map((f) => ({
    page: f.page,
    boundingBox: f.boundingBox,
    text: f.transcribedText,
  }));
  const transcribedText = sorted
    .map((f) => f.transcribedText)
    .filter(Boolean)
    .join("\n");
  const confidence = sorted.reduce((sum, f) => sum + f.confidence, 0) / Math.max(sorted.length, 1);

  return {
    id: `a-${idx}`,
    questionNumber: stripQLabel(sorted[0].questionNumber),
    subpart: sorted[0].subpart ?? null,
    transcribedText,
    confidence,
    regions,
  };
}

/**
 * Groups raw per-page answer fragments (from extractAnswers) into Answer
 * objects, one per distinct (questionNumber, subpart) *occurrence*.
 *
 * Multi-section question papers commonly restart numbering per section (a
 * True/False Q1, a comprehension Q1, and a "who said this" Q1 can all
 * legitimately exist on the same paper). When several fragments share a
 * (questionNumber, subpart) key on the SAME page, that's this collision, not
 * one answer split into pieces — so each becomes its own Answer "occurrence"
 * rather than being concatenated into one. Fragments sharing a key across
 * DIFFERENT pages are the genuine case (one answer continuing on a later
 * page) and are still merged into a single multi-region Answer.
 */
export function groupAnswerFragments(fragments: RawAnswerFragment[]): Answer[] {
  const groups = new Map<string, RawAnswerFragment[]>();

  for (const frag of fragments) {
    const key = groupKey(frag.questionNumber, frag.subpart);
    const existing = groups.get(key);
    if (existing) existing.push(frag);
    else groups.set(key, [frag]);
  }

  const answers: Answer[] = [];
  let idx = 0;
  for (const [, frags] of Array.from(groups.entries())) {
    const byPage = new Map<number, RawAnswerFragment[]>();
    for (const frag of frags) {
      const existing = byPage.get(frag.page);
      if (existing) existing.push(frag);
      else byPage.set(frag.page, [frag]);
    }
    const perPageLists = Array.from(byPage.values());
    const maxPerPage = Math.max(...perPageLists.map((list) => list.length));

    if (maxPerPage <= 1) {
      // Every page contributed at most one fragment for this key: either a
      // single answer, or a genuine multi-page continuation. Merge as one.
      answers.push(buildAnswer(frags, idx++));
    } else {
      // Same-page collision: pair up fragment i across pages (best-effort
      // continuation matching) so each occurrence becomes its own Answer.
      for (let i = 0; i < maxPerPage; i++) {
        const occurrenceFrags = perPageLists.map((list) => list[i]).filter(Boolean);
        answers.push(buildAnswer(occurrenceFrags, idx++));
      }
    }
  }

  return answers;
}

/**
 * Maps questions (in printed order) to grouped answers. Unanswered questions
 * are surfaced with a null answer; answers that match no known question are
 * appended at the end as "unmatched".
 *
 * When multiple questions share a (number, subpart) key (section-restarted
 * numbering — see groupAnswerFragments), there are correspondingly multiple
 * Answer occurrences under that key. They're consumed in document order via
 * shift(), pairing the Nth question with that number to the Nth answer
 * fragment with that number, rather than every such question resolving to
 * a single shared slot.
 */
export function mapQuestionsToAnswers(questions: Question[], answers: Answer[]): MappedItem[] {
  const answersByKey = new Map<string, Answer[]>();
  for (const answer of answers) {
    const key = groupKey(answer.questionNumber, answer.subpart);
    const existing = answersByKey.get(key);
    if (existing) existing.push(answer);
    else answersByKey.set(key, [answer]);
  }

  const matchedAnswerIds = new Set<string>();
  const mapping: MappedItem[] = [];

  for (const question of questions) {
    const key = groupKey(question.number, question.subpart);
    const candidates = answersByKey.get(key);
    const answer = candidates && candidates.length > 0 ? candidates.shift()! : null;
    if (answer) matchedAnswerIds.add(answer.id);

    mapping.push({
      id: `m-${question.id}`,
      status: answer ? "answered" : "unanswered",
      question,
      answer,
      grading: null,
    });
  }

  for (const answer of answers) {
    if (!matchedAnswerIds.has(answer.id)) {
      mapping.push({
        id: `m-unmatched-${answer.id}`,
        status: "unmatched",
        question: null,
        answer,
        grading: null,
      });
    }
  }

  return mapping;
}
