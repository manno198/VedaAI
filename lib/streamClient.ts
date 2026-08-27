import type { StreamEvent } from "./types";

/**
 * Uploads the question paper + answer sheet to /api/process and invokes
 * onEvent for each newline-delimited JSON status/result event streamed back.
 * Using a plain fetch + ReadableStream (rather than EventSource) because the
 * request needs to POST multipart file data, which EventSource can't do.
 */
export async function processDocuments(
  questionFiles: File[],
  answerFiles: File[],
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const formData = new FormData();
  questionFiles.forEach((f) => formData.append("questionPaper", f));
  answerFiles.forEach((f) => formData.append("answerSheet", f));

  const res = await fetch("/api/process", { method: "POST", body: formData, signal });
  if (!res.ok || !res.body) {
    let message = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const text = await res.text();
      if (text) message = text;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const consumeLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      onEvent(JSON.parse(trimmed) as StreamEvent);
    } catch {
      // Ignore malformed lines rather than crashing the whole pipeline.
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(consumeLine);
  }
  if (buffer) consumeLine(buffer);
}
