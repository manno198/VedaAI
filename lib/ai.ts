import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import Groq from "groq-sdk";
import { z } from "zod";
import type { RasterPage } from "./pdf";
import {
  RawAnswerListSchema,
  RawGradingSchema,
  RawQuestionListSchema,
  type RawAnswerFragment,
  type RawQuestion,
} from "./schemas";
import type { Question } from "./types";

// Vision extraction (reading question paper / handwritten answer images,
// including bounding-box grounding) uses Gemini, since Groq's current model
// catalog has no vision-capable chat model. Grading (text-only) uses Groq.
const GEMINI_MODEL_NAME = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const GROQ_MODEL_NAME = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

/** Per-request API key overrides a visitor can supply instead of the server's own keys. */
export type ApiKeyOverrides = {
  gemini?: string | null;
  groq?: string | null;
};

function getGeminiClient(override?: string | null) {
  const apiKey = override || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "No Gemini API key available. Enter your own key, or the site owner needs to set GEMINI_API_KEY."
    );
  }
  return new GoogleGenerativeAI(apiKey);
}

function getGroqClient(override?: string | null) {
  const apiKey = override || process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "No Groq API key available. Enter your own key, or the site owner needs to set GROQ_API_KEY."
    );
  }
  return new Groq({ apiKey });
}

function pageToPart(page: RasterPage): Part {
  return {
    inlineData: {
      data: page.buffer.toString("base64"),
      mimeType: page.mimeType,
    },
  };
}

/** Strips markdown code fences some models add even when JSON mode is requested. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

const STRICT_JSON_SUFFIX = `

IMPORTANT: Your previous response was invalid. Return ONLY a single valid JSON object matching the exact schema described above. No markdown, no comments, no trailing commas, no explanation text.`;

/**
 * Calls Gemini vision with a JSON-mode prompt and validates the result
 * against a Zod schema, retrying once with a stricter prompt on failure.
 */
async function generateValidatedJsonGemini<T extends z.ZodTypeAny>(
  parts: Part[],
  prompt: string,
  schema: T,
  apiKey?: string | null
): Promise<z.infer<T>> {
  const client = getGeminiClient(apiKey);
  const model = client.getGenerativeModel({
    model: GEMINI_MODEL_NAME,
    generationConfig: { responseMimeType: "application/json" },
  });

  const attempt = async (activePrompt: string) => {
    const result = await model.generateContent([activePrompt, ...parts]);
    const text = result.response.text();
    const json = JSON.parse(stripCodeFence(text));
    return schema.parse(json);
  };

  try {
    return await attempt(prompt);
  } catch (firstErr) {
    // Diagnostic: a retry here means a second full Gemini round-trip,
    // which can be enough on its own to blow a 60s budget.
    console.warn(
      `[timing] Gemini call failed validation, retrying: ${
        firstErr instanceof Error ? firstErr.message : String(firstErr)
      }`
    );
    try {
      return await attempt(prompt + STRICT_JSON_SUFFIX);
    } catch (retryErr) {
      throw new Error(
        `Gemini returned invalid JSON after retry: ${
          retryErr instanceof Error ? retryErr.message : String(retryErr)
        }`
      );
    }
  }
}

/**
 * Calls Groq (text-only) with a JSON-mode prompt and validates the result
 * against a Zod schema, retrying once with a stricter prompt on failure.
 */
async function generateValidatedJsonGroq<T extends z.ZodTypeAny>(
  prompt: string,
  schema: T,
  apiKey?: string | null
): Promise<z.infer<T>> {
  const client = getGroqClient(apiKey);

  const attempt = async (activePrompt: string) => {
    const completion = await client.chat.completions.create({
      model: GROQ_MODEL_NAME,
      messages: [{ role: "user", content: activePrompt }],
      response_format: { type: "json_object" },
    });
    const text = completion.choices[0]?.message?.content ?? "";
    const json = JSON.parse(stripCodeFence(text));
    return schema.parse(json);
  };

  try {
    return await attempt(prompt);
  } catch (firstErr) {
    console.warn(
      `[timing] Groq call failed validation, retrying: ${
        firstErr instanceof Error ? firstErr.message : String(firstErr)
      }`
    );
    try {
      return await attempt(prompt + STRICT_JSON_SUFFIX);
    } catch (retryErr) {
      throw new Error(
        `Groq returned invalid JSON after retry: ${
          retryErr instanceof Error ? retryErr.message : String(retryErr)
        }`
      );
    }
  }
}

// --- Question extraction ---

const QUESTION_EXTRACTION_PROMPT = `You are an expert exam-paper reader. You are given one or more images, each a page of a question paper, labeled "Page N" in the order they appear.

Extract every question from the paper, in the exact order they are printed (reading order, across all pages).

Rules:
- If a question has labelled sub-parts (e.g. "11 (a)", "11 (b)", "Q3.i", "Q3.ii"), output EACH sub-part as a SEPARATE entry, sharing the same "number" but with a distinct "subpart" (e.g. number "11", subpart "a"; number "11", subpart "b"). If a question has no sub-parts, set subpart to null.
- Preserve the original printed numbering as text, but WITHOUT any leading "Q"/"Q."/"Question " label and without the sub-part suffix — just the bare identifier (e.g. printed "Q11 (a)" -> number "11", subpart "a"; printed "Question 3" -> number "3"; printed "2.3" -> number "2.3").
- If a question asks for multiple sub-answers under ONE printed number (e.g. "Give meanings of the following words: unusual, downy, gig, stopping, clumsy" or "Fill in the blanks (i-v)"), that is still a SINGLE question entry — do not split it into one entry per word/blank unless the paper itself prints separate labels (a), (b), (i), (ii) etc. for each.
- "text" should be the full question text (instructions + question), excluding the number/subpart label itself.
- "context" — if this question is a reading-comprehension / passage-based question (it refers to a story, poem, or passage printed on the paper), copy the relevant passage/story text here so the question can be graded against it later. Otherwise null. If the same passage serves multiple questions, repeat it in "context" for each of those questions.
- "page" is the 1-indexed page number (matching the "Page N" label) where the question starts.
- "marks" is the marks/points allotted if printed (e.g. "[5 marks]", "(10)"), as a number, else null.
- Skip section headers and pure instructions ("Answer all questions", "Time: 1 hour"), but do NOT skip reading passages — capture those via "context" on the questions that depend on them.

Return ONLY a JSON object of this exact shape, nothing else:
{
  "questions": [
    { "number": "11", "subpart": "a", "text": "...", "context": null, "page": 1, "marks": 5 }
  ]
}`;

export async function extractQuestions(
  pages: RasterPage[],
  apiKeys?: ApiKeyOverrides
): Promise<Question[]> {
  const labeledParts: Part[] = pages.flatMap((page) => [
    { text: `Page ${page.page}:` } as Part,
    pageToPart(page),
  ]);

  const { questions } = await generateValidatedJsonGemini(
    labeledParts,
    QUESTION_EXTRACTION_PROMPT,
    RawQuestionListSchema,
    apiKeys?.gemini
  );

  return questions.map((q: RawQuestion, idx: number) => {
    // Defense in depth: strip a leading "Q"/"Question" label even if the
    // model didn't follow the prompt, so display never doubles it (e.g. "QQ3").
    const number = q.number.replace(/^(?:question|q)\.?\s*/i, "").trim() || q.number;
    return {
      id: `q-${idx}-${number}${q.subpart ? `-${q.subpart}` : ""}`,
      number,
      subpart: q.subpart,
      text: q.text,
      page: q.page,
      marks: q.marks,
      context: q.context,
    };
  });
}

// --- Answer extraction ---

function buildAnswerExtractionPrompt(questionRefList: string): string {
  return `You are an expert at reading handwritten student exam answer sheets. You are given one or more images, each a page of a student's answer sheet, labeled "Page N" in the order they appear.

Here is the AUTHORITATIVE list of every real question on the question paper, in printed order, as (number, subpart, first words) — this came from actually reading that paper, so treat it as ground truth for which (number, subpart) identifiers genuinely exist:
${questionRefList}

EXHAUSTIVENESS IS CRITICAL: every block of handwritten student content on every page must appear in your output as part of some answer entry. Never silently drop or skip a block just because you're unsure which question it belongs to — in that case, still emit an entry with your single best guess for questionNumber and a lower "confidence". Omitting an answer is a worse mistake than mis-numbering it.

For each distinct answer you find (a student may answer questions out of order, and a single answer may continue across multiple pages):
- Identify which question number it is answering by matching against the list above — prefer a (number, subpart) pair that actually appears in that list. Students often write labels like "Ans 11", "Q.11(a)", "11 a)", or just a number; if no explicit label exists, infer it from the question text being echoed, or from context and position (e.g. the next unanswered question in order).
- If the answer is to a labelled sub-part (e.g. "11(a)"), set "subpart" accordingly; otherwise null.
- Watch for numbered/lettered lists on the answer sheet (markers like 1,2,3... or a,b,c... in front of each line) and use the list above to tell whether each marker is a REAL separate question or just the student's own local list numbering:
  - If the list above contains that many separate CONSECUTIVE questions whose numbers match the markers (e.g. three distinct True/False questions numbered 1, 2, 3), then each line answers its own matching question — emit one entry per line with its real number.
  - If instead the list above shows only ONE question here (e.g. "Give meanings of: unusual, downy, gig, stopping, clumsy" is a single question asking for several items), then the whole handwritten list is ONE answer to that one question's number — do not split it or invent new question numbers that aren't in the list above.
- Transcribe the handwritten text as accurately as possible into "transcribedText". If largely illegible, transcribe what you can and lower confidence.
- Report "page" as the 1-indexed page (matching the "Page N" label) this fragment appears on.
- Report a "boundingBox" tightly enclosing ONLY this answer's handwritten region on that page (for a list-style answer to one question, one box spanning the whole list), as {x, y, width, height}, using a NORMALIZED 0-1000 scale where (0,0) is the top-left corner of the page image and 1000 is the full width/height. If you cannot confidently localize the region, set boundingBox to null.
- Report "confidence" from 0 to 1 for how sure you are about both the question-number match and the transcription quality (handwriting legibility).
- If the SAME question's answer continues on a later page, emit a SEPARATE entry for that page's fragment with the same questionNumber/subpart, rather than merging them yourself.
- If multiple distinct questions are answered within the same page/region, emit separate entries with their own bounding boxes.

Return ONLY a JSON object of this exact shape, nothing else:
{
  "answers": [
    { "questionNumber": "11", "subpart": "a", "transcribedText": "...", "page": 1, "boundingBox": {"x":100,"y":200,"width":800,"height":150}, "confidence": 0.8 }
  ]
}`;
}

export async function extractAnswers(
  pages: RasterPage[],
  questions: Question[],
  apiKeys?: ApiKeyOverrides
): Promise<RawAnswerFragment[]> {
  const labeledParts: Part[] = pages.flatMap((page) => [
    { text: `Page ${page.page}:` } as Part,
    pageToPart(page),
  ]);

  const questionRefList =
    questions
      .map((q) => `- ${q.number}${q.subpart ? `(${q.subpart})` : ""}: ${q.text.slice(0, 70)}`)
      .join("\n") || "(none extracted)";

  const { answers } = await generateValidatedJsonGemini(
    labeledParts,
    buildAnswerExtractionPrompt(questionRefList),
    RawAnswerListSchema,
    apiKeys?.gemini
  );

  return answers;
}

// --- Grading ---

const gradeTextSchema = RawGradingSchema;

export type GradeResult = z.infer<typeof gradeTextSchema>;

export async function gradeAnswer(
  questionText: string,
  answerText: string,
  maxMarks: number,
  context?: string | null,
  apiKeys?: ApiKeyOverrides
): Promise<GradeResult> {
  const passageBlock = context
    ? `\nSource passage this question is based on — grade strictly against THIS text, not outside knowledge: """${context}"""\n`
    : "";

  const prompt = `You are grading a student's exam answer.

Question (worth ${maxMarks} marks): """${questionText}"""
${passageBlock}
Student's answer (transcribed from handwriting, may contain OCR errors): """${
    answerText.trim() || "(no answer provided)"
  }"""

Grade the answer out of ${maxMarks} marks. Be fair but rigorous. If the answer is empty or clearly off-topic, score 0 and verdict "incorrect".

${
  context
    ? "A source passage was provided above — verify facts against it, not against your own general knowledge of similar stories/topics."
    : "No source passage was provided for this question. If it appears to reference a specific story/passage you cannot see, do NOT invent or assume a specific \"correct\" answer from your own general knowledge — you cannot verify it. In that case, grade leniently based on whether the answer is coherent, relevant, and plausibly responsive to the question, and say in your feedback that this couldn't be verified against the source text."
}

Return ONLY a JSON object of this exact shape, nothing else:
{ "score": 0, "verdict": "correct" | "partially-correct" | "incorrect", "feedback": "1-2 concise sentences of feedback" }`;

  return generateValidatedJsonGroq(prompt, gradeTextSchema, apiKeys?.groq);
}
