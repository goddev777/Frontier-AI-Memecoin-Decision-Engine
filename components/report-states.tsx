"use client";

import { AlertTriangle, LoaderCircle, RefreshCcw, SearchX } from "lucide-react";

type ErrorStateProps = {
  message?: string;
  onRetry?: () => void;
};

type EmptyStateProps = {
  title?: string;
  description: string;
};

export function LoadingState() {
  return (
    <div className="terminal-shell rounded-[32px] p-6 sm:p-8">
      <div className="flex items-center gap-3 text-cyan">
        <LoaderCircle className="h-5 w-5 animate-spin" />
        <span className="terminal-heading text-cyan">Syncing report feed</span>
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-[1.4fr,0.8fr]">
        <div className="space-y-4">
          <div className="h-36 animate-pulse rounded-[28px] bg-white/5" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-28 animate-pulse rounded-[24px] bg-white/5" />
            <div className="h-28 animate-pulse rounded-[24px] bg-white/5" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded-[28px] bg-white/5" />
          <div className="h-24 animate-pulse rounded-[24px] bg-white/5" />
        </div>
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="terminal-shell rounded-[32px] p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl border border-ember/30 bg-ember/10 p-3 text-ember">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <p className="terminal-heading text-ember">Feed exception</p>
          <h2 className="text-2xl font-semibold text-ink">The report terminal could not finish the request.</h2>
          <p className="max-w-2xl text-sm leading-6 text-mute">
            {message ||
              "Check the analysis API response for this mint, then retry the lookup from the terminal."}
          </p>
        </div>
      </div>

      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-ink transition hover:border-cyan/40 hover:text-cyan"
        >
          <RefreshCcw className="h-4 w-4" />
          Retry request
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title = "No report loaded", description }: EmptyStateProps) {
  return (
    <div className="terminal-shell rounded-[32px] p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-cyan">
          <SearchX className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <p className="terminal-heading">Awaiting mint</p>
          <h2 className="text-2xl font-semibold text-ink">{title}</h2>
          <p className="max-w-2xl text-sm leading-6 text-mute">{description}</p>
        </div>
      </div>
    </div>
  );
}
