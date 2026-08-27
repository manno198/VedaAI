"use client";

import { useState } from "react";
import type { ApiKeyChoice, StoredApiKeys } from "@/lib/apiKeyStorage";
import { IconKey, IconSparkle } from "@/components/icons";

export function ApiKeyModal({
  initial,
  onSave,
}: {
  initial: StoredApiKeys | null;
  onSave: (data: StoredApiKeys) => void;
}) {
  const [choice, setChoice] = useState<ApiKeyChoice>(initial?.choice ?? "shared");
  const [geminiApiKey, setGeminiApiKey] = useState(initial?.geminiApiKey ?? "");
  const [groqApiKey, setGroqApiKey] = useState(initial?.groqApiKey ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <IconSparkle className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-bold text-ink">Choose your API keys</h2>
        </div>
        <p className="mt-1.5 text-sm text-black/50">
          This app calls Gemini (vision) and Groq (grading) to process your documents.
        </p>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setChoice("shared")}
            className={`rounded-xl border-2 p-3.5 text-left transition-colors ${
              choice === "shared" ? "border-accent bg-accent-light/30" : "border-black/10 hover:border-black/20"
            }`}
          >
            <p className="text-sm font-bold text-ink">Use the free demo keys</p>
            <p className="mt-0.5 text-xs text-black/50">
              Quick start with no setup — shared across everyone trying the demo, so it may hit rate
              limits during heavy use.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setChoice("own")}
            className={`rounded-xl border-2 p-3.5 text-left transition-colors ${
              choice === "own" ? "border-accent bg-accent-light/30" : "border-black/10 hover:border-black/20"
            }`}
          >
            <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
              <IconKey className="h-4 w-4" />
              Use my own API keys
            </p>
            <p className="mt-0.5 text-xs text-black/50">
              Your own free-tier quota, not shared with anyone else. Keys stay in your browser and are
              sent only to this app&apos;s server, per request — never stored or logged.
            </p>
          </button>
        </div>

        {choice === "own" && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl bg-black/[0.03] p-3.5">
            <div>
              <label className="flex items-center justify-between text-xs font-semibold text-ink/70">
                Gemini API key
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-accent hover:underline"
                >
                  Get a free key ↗
                </a>
              </label>
              <input
                type="password"
                autoComplete="off"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="Leave blank to use the demo key for this one"
                className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="flex items-center justify-between text-xs font-semibold text-ink/70">
                Groq API key
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-accent hover:underline"
                >
                  Get a free key ↗
                </a>
              </label>
              <input
                type="password"
                autoComplete="off"
                value={groqApiKey}
                onChange={(e) => setGroqApiKey(e.target.value)}
                placeholder="Leave blank to use the demo key for this one"
                className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => onSave({ choice, geminiApiKey: geminiApiKey.trim(), groqApiKey: groqApiKey.trim() })}
          className="mt-5 w-full rounded-full bg-ink py-2.5 text-sm font-semibold text-white hover:bg-ink-soft"
        >
          Continue
        </button>
        <p className="mt-2.5 text-center text-[11px] text-black/35">
          You can change this anytime from the key icon next to your profile.
        </p>
      </div>
    </div>
  );
}
