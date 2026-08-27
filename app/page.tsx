"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { UploadForm } from "@/components/UploadForm";
import { LoadingState, type StageState } from "@/components/LoadingState";
import { ResultsView } from "@/components/ResultsView";
import { ApiKeyModal } from "@/components/ApiKeyModal";
import { processDocuments } from "@/lib/streamClient";
import { loadStoredApiKeys, saveApiKeyChoice, type StoredApiKeys } from "@/lib/apiKeyStorage";
import type { GradingSummary, MappedItem, PageImage } from "@/lib/types";

type Phase = "upload" | "processing" | "results";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [stages, setStages] = useState<StageState>({});
  const [mapping, setMapping] = useState<MappedItem[]>([]);
  const [answerPages, setAnswerPages] = useState<PageImage[]>([]);
  const [summary, setSummary] = useState<GradingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyPrefs, setApiKeyPrefs] = useState<StoredApiKeys | null>(null);
  // Shown on every fresh visit/reload of the home page (pre-filled from any
  // saved preference), not just the first time — see onOpenApiKeys for the
  // manual reopen path, which uses the same modal. Stays false until the
  // localStorage read below completes, so the modal never mounts with a
  // stale/empty `initial` before the saved preference is available.
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setApiKeyPrefs(loadStoredApiKeys());
    setShowApiKeyModal(true);
  }, []);

  const handleSaveApiKeys = useCallback((data: StoredApiKeys) => {
    saveApiKeyChoice(data);
    setApiKeyPrefs(data);
    setShowApiKeyModal(false);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setPhase("upload");
    setStages({});
    setMapping([]);
    setAnswerPages([]);
    setSummary(null);
    setError(null);
  }, []);

  const handleSubmit = useCallback(
    async (questionFiles: File[], answerFiles: File[]) => {
      setPhase("processing");
      setStages({});
      setMapping([]);
      setAnswerPages([]);
      setSummary(null);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await processDocuments(
          questionFiles,
          answerFiles,
          (event) => {
            switch (event.type) {
              case "stage":
                setStages((prev) => ({ ...prev, [event.stage]: event.status }));
                break;
              case "images":
                setAnswerPages(event.data.answerPages);
                break;
              case "mapping":
                setMapping(event.data);
                break;
              case "grade":
                setMapping((prev) =>
                  prev.map((m) => (m.id === event.data.id ? { ...m, grading: event.data.grading } : m))
                );
                break;
              case "summary":
                setSummary(event.data);
                break;
              case "done":
                setMapping(event.data.mapping);
                setAnswerPages(event.data.answerPages);
                setSummary(event.data.summary);
                setPhase("results");
                break;
              case "error":
                setError(event.message);
                break;
            }
          },
          controller.signal,
          apiKeyPrefs?.choice === "own"
            ? { geminiApiKey: apiKeyPrefs.geminiApiKey, groqApiKey: apiKeyPrefs.groqApiKey }
            : undefined
        );
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Something went wrong while processing.");
        }
      }
    },
    [apiKeyPrefs]
  );

  return (
    <AppShell
      sidebarExpanded={phase === "upload"}
      onBack={phase !== "upload" ? reset : undefined}
      onOpenApiKeys={() => setShowApiKeyModal(true)}
    >
      {showApiKeyModal && <ApiKeyModal initial={apiKeyPrefs} onSave={handleSaveApiKeys} />}

      {phase === "upload" && (
        <div className="mx-auto max-w-4xl">
          <UploadForm onSubmit={handleSubmit} />
          {error && (
            <p className="mx-auto -mt-4 max-w-3xl rounded-lg bg-danger-light px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      )}

      {phase === "processing" && (
        <div className="flex h-full flex-col">
          <LoadingState stages={stages} />
          {error && (
            <div className="mx-auto -mt-16 max-w-md rounded-lg bg-danger-light px-4 py-3 text-center text-sm text-danger">
              <p>{error}</p>
              <button type="button" onClick={reset} className="mt-2 font-semibold underline underline-offset-2">
                Start over
              </button>
            </div>
          )}
        </div>
      )}

      {phase === "results" && <ResultsView mapping={mapping} answerPages={answerPages} summary={summary} />}
    </AppShell>
  );
}
