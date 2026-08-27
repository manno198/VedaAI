// Shared types for the assessment extraction pipeline.

export type BoundingBox = {
  /** Normalized 0-1000 scale (Gemini-style), top-left origin */
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Question = {
  id: string;
  /** Printed question number, e.g. "11" */
  number: string;
  /** Sub-part label, e.g. "a" for 11(a). Null if not a sub-part. */
  subpart: string | null;
  text: string;
  /** 1-indexed page number within the question paper */
  page: number;
  marks: number | null;
  /** Reading passage / comprehension text this question is based on, if any */
  context: string | null;
};

export type AnswerRegion = {
  /** 1-indexed page number within the answer sheet */
  page: number;
  boundingBox: BoundingBox | null;
  /** Text transcribed from just this region/page fragment */
  text: string;
};

export type Answer = {
  id: string;
  questionNumber: string;
  subpart: string | null;
  /** Combined transcribed text across all regions/pages */
  transcribedText: string;
  /** 0-1 confidence from the model */
  confidence: number;
  regions: AnswerRegion[];
};

export type Verdict = "correct" | "partially-correct" | "incorrect" | "ungraded";

/**
 * "paper" — maxMarks came from a value actually printed on the question paper.
 * "assumed" — the question paper didn't print marks for this question, so the
 * pipeline's 10-mark fallback denominator was used (see app/api/process/route.ts).
 */
export type MarksSource = "paper" | "assumed";

export type Grading = {
  score: number;
  maxMarks: number;
  marksSource: MarksSource;
  verdict: Verdict;
  feedback: string;
};

export type MappingStatus = "answered" | "unanswered" | "unmatched";

export type MappedItem = {
  id: string;
  status: MappingStatus;
  question: Question | null;
  answer: Answer | null;
  grading: Grading | null;
};

export type PageImage = {
  page: number;
  dataUrl: string;
  width: number;
  height: number;
};

export type GradingSummary = {
  totalScore: number;
  totalMaxMarks: number;
  answeredCount: number;
  totalQuestions: number;
  percentAnswered: number;
  weakAreas: string[];
  /** Count of graded questions whose marks weren't printed on the paper and used the assumed 10-mark fallback */
  assumedMarksCount: number;
};

export type FullPayload = {
  questions: Question[];
  answers: Answer[];
  mapping: MappedItem[];
  questionPages: PageImage[];
  answerPages: PageImage[];
  summary: GradingSummary | null;
};

// --- Streaming protocol between /api/process and the client ---

export type StageName =
  | "upload"
  | "convert"
  | "extract-questions"
  | "extract-answers"
  | "map"
  | "grade"
  | "done";

export type StageStatus = "start" | "done" | "error";

export type StreamEvent =
  | { type: "stage"; stage: StageName; status: StageStatus; message?: string }
  | { type: "questions"; data: Question[] }
  | { type: "answers"; data: Answer[] }
  | { type: "mapping"; data: MappedItem[] }
  | { type: "grade"; data: { id: string; grading: Grading } }
  | { type: "images"; data: { questionPages: PageImage[]; answerPages: PageImage[] } }
  | { type: "summary"; data: GradingSummary }
  | { type: "done"; data: FullPayload }
  | { type: "error"; message: string };
