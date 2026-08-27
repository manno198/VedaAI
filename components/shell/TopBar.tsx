"use client";

import { IconBack, IconBell, IconExams, IconHelp, IconKey, IconMenu, IconSparkle } from "@/components/icons";

export function TopBar({ onBack, onOpenApiKeys }: { onBack?: () => void; onOpenApiKeys?: () => void }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-black/5 bg-white/70 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onBack}
        disabled={!onBack}
        className={`flex h-7 w-7 items-center justify-center rounded-full ${
          onBack ? "text-ink hover:bg-black/5" : "text-black/20"
        }`}
        aria-label="Back"
      >
        <IconBack className="h-4 w-4" />
      </button>

      <span className="hidden items-center gap-1.5 text-sm font-medium text-ink/70 sm:flex">
        <IconExams className="h-4 w-4" />
        Exams
      </span>

      <span className="text-sm font-bold text-ink sm:hidden">VedaAI</span>

      <div className="ml-auto flex items-center gap-3">
        <IconHelp className="hidden h-5 w-5 text-ink/40 sm:block" />
        <span className="relative hidden sm:block">
          <IconBell className="h-5 w-5 text-ink/40" />
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
        </span>
        <span className="relative sm:hidden">
          <IconBell className="h-5 w-5 text-ink/40" />
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
        </span>
        <IconSparkle className="hidden h-4 w-4 text-ink/40 sm:block" />

        <button
          type="button"
          onClick={onOpenApiKeys}
          className="flex h-7 w-7 items-center justify-center rounded-full text-ink/40 hover:bg-black/5 hover:text-ink"
          aria-label="API key settings"
          title="API key settings"
        >
          <IconKey className="h-4 w-4" />
        </button>

        <div className="hidden items-center gap-2 sm:flex">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-light text-xs font-bold text-accent-dark">
            MR
          </span>
          <span className="text-sm font-medium text-ink/80">Madhur Rastogi</span>
        </div>

        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-light text-xs font-bold text-accent-dark sm:hidden">
          MR
        </span>
        <button type="button" className="text-ink/60 lg:hidden" aria-label="Menu">
          <IconMenu className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
