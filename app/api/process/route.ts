import type { NextRequest } from "next/server";
import { rasterizeDocument, toDataUrl, type RasterPage } from "@/lib/pdf";
import { extractQuestions, extractAnswers, gradeAnswer, type ApiKeyOverrides } from "@/lib/ai";
import { groupAnswerFragments, mapQuestionsToAnswers } from "@/lib/mapping";
import { formatQuestionLabel } from "@/lib/format";
import type {
  StreamEvent,
  PageImage,
  FullPayload,
  Grading,
  GradingSummary,
  MappedItem,
} from "@/lib/types";

// pdf-to-img relies on native canvas bindings and Node Buffers, so this
// route must run on the Node.js runtime (not the Edge runtime).
export const runtime = "nodejs";
export const maxDuration = 60;

function pagesToPageImages(pages: RasterPage[]): PageImage[] {
  return pages.map((p) => ({
    page: p.page,
    dataUrl: toDataUrl(p),
    width: p.width,
    height: p.height,
  }));
}

function guessMimeFromName(name: string): string {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
}

async function rasterizeAll(files: File[]): Promise<RasterPage[]> {
  const allPages: RasterPage[] = [];
  let pageOffset = 0;
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || guessMimeFromName(file.name);
    const pages = await rasterizeDocument(buf, mimeType);
    for (const p of pages) {
      allPages.push({ ...p, page: p.page + pageOffset });
    }
    pageOffset += pages.length;
  }
  return allPages;
}

async function gradeAll(
  mapping: MappedItem[],
  send: (e: StreamEvent) => void,
  apiKeys?: ApiKeyOverrides
) {
  const gradable = mapping.filter((m) => m.status !== "unmatched" && m.question);
  const CONCURRENCY = 3;
  let cursor = 0;

  async function worker() {
    while (cursor < gradable.length) {
      const item = gradable[cursor++];
      const question = item.question!;
      const maxMarks = question.marks ?? 10;
      const marksSource: Grading["marksSource"] = question.marks !== null ? "paper" : "assumed";

      if (item.status === "unanswered") {
        item.grading = {
          score: 0,
          maxMarks,
          marksSource,
          verdict: "incorrect",
          feedback: "No answer was detected for this question.",
        };
      } else {
        try {
          const result = await gradeAnswer(
            question.text,
            item.answer!.transcribedText,
            maxMarks,
            question.context,
            apiKeys
          );
          item.grading = {
            score: Math.min(Math.max(result.score, 0), maxMarks),
            maxMarks,
            marksSource,
            verdict: result.verdict,
            feedback: result.feedback,
          };
        } catch {
          item.grading = {
            score: 0,
            maxMarks,
            marksSource,
            verdict: "ungraded",
            feedback: "Automatic grading failed for this answer; please review manually.",
          };
        }
      }

      send({ type: "grade", data: { id: item.id, grading: item.grading! } });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, gradable.length) }, () => worker())
  );
}

function computeSummary(mapping: MappedItem[], totalQuestions: number): GradingSummary {
  const graded = mapping.filter((m) => m.status !== "unmatched" && m.grading);
  const totalScore = graded.reduce((sum, m) => sum + (m.grading?.score ?? 0), 0);
  const totalMaxMarks = graded.reduce((sum, m) => sum + (m.grading?.maxMarks ?? 0), 0);
  const answeredCount = mapping.filter((m) => m.status === "answered").length;
  const percentAnswered =
    totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const weakAreas = graded
    .filter((m) => m.grading && m.grading.verdict !== "correct" && m.question)
    .map((m) => formatQuestionLabel(m.question!))
    .slice(0, 6);

  const assumedMarksCount = graded.filter((m) => m.grading?.marksSource === "assumed").length;

  return {
    totalScore,
    totalMaxMarks,
    answeredCount,
    totalQuestions,
    percentAnswered,
    weakAreas,
    assumedMarksCount,
  };
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: StreamEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        send({ type: "stage", stage: "upload", status: "start" });
        const formData = await req.formData();
        const questionFiles = formData.getAll("questionPaper").filter((f): f is File => f instanceof File);
        const answerFiles = formData.getAll("answerSheet").filter((f): f is File => f instanceof File);
        const geminiApiKeyField = formData.get("geminiApiKey");
        const groqApiKeyField = formData.get("groqApiKey");
        const apiKeys: ApiKeyOverrides = {
          gemini: typeof geminiApiKeyField === "string" && geminiApiKeyField.trim() ? geminiApiKeyField.trim() : undefined,
          groq: typeof groqApiKeyField === "string" && groqApiKeyField.trim() ? groqApiKeyField.trim() : undefined,
        };

        if (questionFiles.length === 0 || answerFiles.length === 0) {
          send({
            type: "error",
            message: "Please upload both a question paper and an answer sheet.",
          });
          closed = true;
          controller.close();
          return;
        }
        send({ type: "stage", stage: "upload", status: "done" });

        send({ type: "stage", stage: "convert", status: "start" });
        const [questionPages, answerPages] = await Promise.all([
          rasterizeAll(questionFiles),
          rasterizeAll(answerFiles),
        ]);
        send({
          type: "images",
          data: {
            questionPages: pagesToPageImages(questionPages),
            answerPages: pagesToPageImages(answerPages),
          },
        });
        send({ type: "stage", stage: "convert", status: "done" });

        send({ type: "stage", stage: "extract-questions", status: "start" });
        const questions = await extractQuestions(questionPages, apiKeys);
        send({ type: "questions", data: questions });
        send({ type: "stage", stage: "extract-questions", status: "done" });

        send({ type: "stage", stage: "extract-answers", status: "start" });
        const rawFragments = await extractAnswers(answerPages, questions, apiKeys);
        const answers = groupAnswerFragments(rawFragments);
        send({ type: "answers", data: answers });
        send({ type: "stage", stage: "extract-answers", status: "done" });

        send({ type: "stage", stage: "map", status: "start" });
        const mapping = mapQuestionsToAnswers(questions, answers);
        send({ type: "mapping", data: mapping });
        send({ type: "stage", stage: "map", status: "done" });

        send({ type: "stage", stage: "grade", status: "start" });
        await gradeAll(mapping, send, apiKeys);
        send({ type: "stage", stage: "grade", status: "done" });

        const summary = computeSummary(mapping, questions.length);
        send({ type: "summary", data: summary });

        const payload: FullPayload = {
          questions,
          answers,
          mapping,
          questionPages: pagesToPageImages(questionPages),
          answerPages: pagesToPageImages(answerPages),
          summary,
        };
        send({ type: "done", data: payload });
        send({ type: "stage", stage: "done", status: "done" });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
