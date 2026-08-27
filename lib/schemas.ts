import { z } from "zod";

// --- Question extraction ---

export const RawQuestionSchema = z.object({
  number: z.string().min(1),
  subpart: z.string().nullable().optional().default(null),
  text: z.string().min(1),
  page: z.number().int().min(1),
  marks: z.number().nullable().optional().default(null),
  context: z.string().nullable().optional().default(null),
});

export const RawQuestionListSchema = z.object({
  questions: z.array(RawQuestionSchema),
});

export type RawQuestion = z.infer<typeof RawQuestionSchema>;

// --- Answer extraction ---

export const RawBoundingBoxSchema = z.object({
  x: z.number().min(0).max(1000),
  y: z.number().min(0).max(1000),
  width: z.number().min(0).max(1000),
  height: z.number().min(0).max(1000),
});

export const RawAnswerFragmentSchema = z.object({
  questionNumber: z.string().min(1),
  subpart: z.string().nullable().optional().default(null),
  transcribedText: z.string().default(""),
  page: z.number().int().min(1),
  boundingBox: RawBoundingBoxSchema.nullable().optional().default(null),
  confidence: z.number().min(0).max(1).default(0.5),
});

export const RawAnswerListSchema = z.object({
  answers: z.array(RawAnswerFragmentSchema),
});

export type RawAnswerFragment = z.infer<typeof RawAnswerFragmentSchema>;

// --- Grading ---

export const RawGradingSchema = z.object({
  score: z.number().min(0),
  verdict: z.enum(["correct", "partially-correct", "incorrect"]),
  feedback: z.string().min(1),
});

export type RawGrading = z.infer<typeof RawGradingSchema>;
