"use client";

import { AlertTriangle, LoaderCircle, RefreshCcw, SearchX } from "lucide-react";

const SAMPLE_LOOKUPS = [
  { label: "BONK", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
  { label: "JUP", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" },
  { label: "FART", mint: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump" }
] as const;

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
    <div className="terminal-shell rounded-[34px] p-6 sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-cyan">
          <div className="rounded-2xl border border-cyan/20 bg-cyan/[0.1] p-3">
            <LoaderCircle className="h-5 w-5 animate-spin" />
          </div>
          <div>
            <p className="terminal-heading !text-cyan">Syncing report feed</p>
            <p className="mt-2 text-sm leading-6 text-mute">
              Pulling market, holder, security, and narrative layers into the report shell.
            </p>
          </div>
        </div>

        <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs uppercase tracking-[0.18em] text-mute">
          Live analysis
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
        <div className="space-y-4">
          <div className="h-28 animate-pulse rounded-[28px] bg-white/[0.05]" />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="h-24 animate-pulse rounded-[24px] bg-white/[0.05]" />
            <div className="h-24 animate-pulse rounded-[24px] bg-white/[0.05]" />
            <div className="h-24 animate-pulse rounded-[24px] bg-white/[0.05]" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-40 animate-pulse rounded-[28px] bg-white/[0.05]" />
            <div className="grid gap-4">
              <div className="h-[92px] animate-pulse rounded-[24px] bg-white/[0.05]" />
              <div className="h-[92px] animate-pulse rounded-[24px] bg-white/[0.05]" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="h-64 animate-pulse rounded-[30px] bg-white/[0.05]" />
          <div className="h-28 animate-pulse rounded-[26px] bg-white/[0.05]" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="h-24 animate-pulse rounded-[24px] bg-white/[0.05]" />
            <div className="h-24 animate-pulse rounded-[24px] bg-white/[0.05]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="terminal-shell rounded-[34px] p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="rounded-[24px] border border-ember/25 bg-ember/[0.12] p-3 text-ember">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <p className="terminal-heading !text-ember">Feed exception</p>
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-ink">The report terminal could not finish the request.</h2>
          <p className="max-w-2xl text-sm leading-6 text-mute">
            {message || "Check the analysis API response for this mint, then retry the lookup from the terminal."}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-2 rounded-[20px] border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-ink transition hover:border-cyan/35 hover:text-cyan"
          >
            <RefreshCcw className="h-4 w-4" />
            Retry request
          </button>
        ) : null}

        <a
          href="/"
          className="inline-flex items-center justify-center rounded-[20px] border border-white/10 bg-black/20 px-4 py-3 text-sm font-medium text-mute transition hover:border-white/20 hover:text-ink"
        >
          Back to search
        </a>
      </div>
    </div>
  );
}

export function EmptyState({ title = "No report loaded", description }: EmptyStateProps) {
  return (
    <div className="terminal-shell rounded-[34px] p-6 sm:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-3 text-cyan">
            <SearchX className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <p className="terminal-heading">Awaiting mint</p>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-ink">{title}</h2>
            <p className="max-w-2xl text-sm leading-6 text-mute">{description}</p>
          </div>
        </div>

        <div className="rounded-full border border-lime/20 bg-lime/[0.08] px-3 py-1 text-xs uppercase tracking-[0.18em] text-lime">
          Quick start
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {SAMPLE_LOOKUPS.map((sample) => (
          <a
            key={sample.mint}
            href={`/?mint=${encodeURIComponent(sample.mint)}`}
            className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4 transition hover:border-cyan/35 hover:bg-white/[0.07]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">{sample.label}</p>
            <p className="mt-2 text-sm leading-6 text-mute">{sample.mint.slice(0, 10)}...{sample.mint.slice(-8)}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
