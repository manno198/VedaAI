export type ApiKeyChoice = "shared" | "own";

export type StoredApiKeys = {
  choice: ApiKeyChoice;
  geminiApiKey: string;
  groqApiKey: string;
};

const STORAGE_KEY = "veda-ai:api-keys";

/** Reads the visitor's saved API key preference. Returns null if never set or storage is unavailable. */
export function loadStoredApiKeys(): StoredApiKeys | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.choice === "shared" || parsed.choice === "own")) {
      return {
        choice: parsed.choice,
        geminiApiKey: typeof parsed.geminiApiKey === "string" ? parsed.geminiApiKey : "",
        groqApiKey: typeof parsed.groqApiKey === "string" ? parsed.groqApiKey : "",
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveApiKeyChoice(data: StoredApiKeys): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Private browsing / storage disabled — the choice just won't persist across visits.
  }
}
