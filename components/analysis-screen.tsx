"use client";

import { useEffect, useMemo, useState } from "react";
import { Bolt, Radar, ShieldAlert, Waypoints } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { fetchAnalysisReport, isProbablySolanaMint, normalizeMint } from "@/app/_lib/analysis-api";
import { MintSearch } from "@/components/mint-search";
import { EmptyState, ErrorState, LoadingState } from "@/components/report-states";
import { ReportView } from "@/components/report-view";
import type { AnalysisReport } from "@/lib/types";

type AnalysisScreenProps = {
  mode: "home" | "token";
  initialMint?: string;
};

type ViewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; report: AnalysisReport }
  | { status: "empty" }
  | { status: "error"; message: string };

export function AnalysisScreen({ mode, initialMint }: AnalysisScreenProps) {
  const searchParams = useSearchParams();
  const queryMint = searchParams.get("mint");
  const activeMint = useMemo(
    () => normalizeMint(mode === "home" ? queryMint : initialMint),
    [initialMint, mode, queryMint]
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<ViewState>(activeMint ? { status: "loading" } : { status: "idle" });

  useEffect(() => {
    if (!activeMint) {
      setState({ status: "idle" });
      return;
    }

    if (!isProbablySolanaMint(activeMint)) {
      setState({
        status: "error",
        message: "This route does not look like a valid Solana mint. Use a base58 mint between 32 and 44 characters."
      });
      return;
    }

    const controller = new AbortController();
    let ignore = false;

    setState({ status: "loading" });

    fetchAnalysisReport(activeMint, controller.signal)
      .then((report) => {
        if (ignore) {
          return;
        }

        if (!report) {
          setState({ status: "empty" });
          return;
        }

        setState({ status: "success", report });
      })
      .catch((error: unknown) => {
        if (ignore || controller.signal.aborted) {
          return;
        }

        const message = error instanceof Error ? error.message : "Unknown analysis API error";
        setState({ status: "error", message });
      });

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [activeMint, refreshKey]);

  const commandDeck = [
    {
      label: "Scan",
      value: "Any Solana mint",
      detail: "Paste once and push the AI decision stack into motion.",
      icon: Bolt,
      tone: "text-cyan"
    },
    {
      label: "Read",
      value: "Frontier-model thesis",
      detail: "AI turns market and wallet data into an actionable setup read.",
      icon: Radar,
      tone: "text-white/80"
    },
    {
      label: "Defend",
      value: "Breakers above fold",
      detail: "Risk framing, concentration, and control flags stay prominent.",
      icon: ShieldAlert,
      tone: "text-ember"
    },
    {
      label: "Route",
      value: "Desktop dense / mobile sharp",
      detail: "AI-led decision support without losing speed on smaller screens.",
      icon: Waypoints,
      tone: "text-lime"
    }
  ] as const;

  return (
    <main className="relative min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,rgba(99,232,255,0.08),transparent_65%)]" />

      <div className="relative mx-auto max-w-7xl space-y-5 sm:space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-mute">
              {mode === "home" ? "AI-first discovery route" : "Dedicated AI decision route"}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-ink sm:text-3xl">
              Frontier AI memecoin decisions for Solana traders.
            </h1>
            <p className="mt-2 text-sm leading-6 text-mute sm:text-base">
              Fast contract reads, AI-written setup framing, and clean signal separation when you are comparing entries, trims, and skips.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-mute">
            {activeMint ? `Live mint loaded: ${activeMint.slice(0, 6)}...${activeMint.slice(-6)}` : "No mint loaded yet"}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.24fr,0.76fr]">
          <MintSearch initialMint={activeMint} mode={mode} />

          <aside className="terminal-shell rounded-[32px] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="terminal-heading">Command deck</p>
                <p className="mt-2 text-base font-semibold text-ink">Built for AI-led memecoin decisions, not passive dashboard browsing.</p>
              </div>
              <div className="rounded-full border border-lime/20 bg-lime/[0.08] px-3 py-1 text-xs uppercase tracking-[0.18em] text-lime">
                Mobile ready
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {commandDeck.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.label} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                    <div className={`flex items-center gap-2 ${item.tone}`}>
                      <Icon className="h-4 w-4" />
                      <p className="terminal-heading !text-current">{item.label}</p>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-ink">{item.value}</p>
                    <p className="mt-2 text-sm leading-6 text-mute">{item.detail}</p>
                  </div>
                );
              })}
            </div>

            <div className="my-5 terminal-rule" />

            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <p className="terminal-heading">Provider mesh</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["DexScreener", "Helius", "Solana RPC", "OpenRouter"].map((item) => (
                  <div
                    key={item}
                    className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs uppercase tracking-[0.16em] text-mute"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {state.status === "idle" ? (
          <EmptyState
            title="Load a Solana mint"
            description="The AI decision engine is ready. Paste a mint to generate setup framing, market scenarios, holder structure, and trade breakers."
          />
        ) : null}

        {state.status === "loading" ? <LoadingState /> : null}

        {state.status === "error" ? (
          <ErrorState message={state.message} onRetry={() => setRefreshKey((value) => value + 1)} />
        ) : null}

        {state.status === "empty" ? (
          <EmptyState
            title="No analysis returned"
            description="The AI pipeline completed but no normalized report object came back for this mint. Check the mint or the backend response shape and try again."
          />
        ) : null}

        {state.status === "success" ? <ReportView report={state.report} /> : null}
      </div>
    </main>
  );
}
