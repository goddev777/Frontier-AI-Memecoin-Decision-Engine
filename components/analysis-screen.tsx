"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Gauge, ShieldAlert } from "lucide-react";
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

  const terminalStats = [
    {
      label: "Focus",
      value: "Facts / Signals / Scenarios",
      icon: BarChart3
    },
    {
      label: "Sizing",
      value: "Tier + Horizon Above Fold",
      icon: Gauge
    },
    {
      label: "Warnings",
      value: "Security + Breakers Surface First",
      icon: ShieldAlert
    },
    {
      label: "AI Layer",
      value: "OpenRouter free-model enrichment is optional; deterministic output stays first-class.",
      icon: Gauge
    }
  ];

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-5">
        <div className="grid gap-3 lg:grid-cols-[1.2fr,0.8fr]">
          <MintSearch initialMint={activeMint} mode={mode} />

          <aside className="terminal-shell rounded-[28px] p-4 sm:p-5">
            <p className="terminal-heading">Desk framing</p>
            <div className="mt-4 space-y-3">
              {terminalStats.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-center gap-2 text-cyan">
                      <Icon className="h-4 w-4" />
                      <p className="terminal-heading text-cyan">{item.label}</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-ink">{item.value}</p>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>

        {state.status === "idle" ? (
          <EmptyState
            title="Load a Solana mint"
            description="The report shell is ready. Paste a mint to inspect the setup summary, why it surfaced, what can break it, scenario ranges, suggested size tier, and time horizon."
          />
        ) : null}

        {state.status === "loading" ? <LoadingState /> : null}

        {state.status === "error" ? (
          <ErrorState message={state.message} onRetry={() => setRefreshKey((value) => value + 1)} />
        ) : null}

        {state.status === "empty" ? (
          <EmptyState
            title="No analysis returned"
            description="The API completed but did not return a normalized report object for this mint. Check the mint or the backend response shape and try again."
          />
        ) : null}

        {state.status === "success" ? <ReportView report={state.report} /> : null}
      </div>
    </main>
  );
}
