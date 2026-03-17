import {
  Activity,
  ArrowUpRight,
  Bot,
  CircleAlert,
  Clock3,
  ExternalLink,
  Radar,
  Shield,
  Target,
  Users,
  Waypoints
} from "lucide-react";
import type { ReactNode } from "react";

import type { AnalysisFact, AnalysisReport, AnalysisRisk, AnalysisScenario } from "@/lib/types";

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1 ? 2 : 4
  }).format(value);
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }

  return `${value.toFixed(1)}%`;
}

function formatDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(parsed);
}

function toneClass(tone?: AnalysisFact["tone"]) {
  switch (tone) {
    case "positive":
      return "border-lime/30 bg-lime/10 text-lime";
    case "negative":
      return "border-ember/30 bg-ember/10 text-ember";
    case "caution":
      return "border-amber-300/30 bg-amber-300/10 text-amber-200";
    default:
      return "border-white/10 bg-white/5 text-ink";
  }
}

function severityClass(severity: AnalysisRisk["severity"]) {
  switch (severity) {
    case "high":
      return "border-ember/30 bg-ember/10 text-ember";
    case "medium":
      return "border-amber-300/30 bg-amber-300/10 text-amber-200";
    default:
      return "border-cyan/20 bg-cyan/10 text-cyan";
  }
}

function scoreRing(report: AnalysisReport) {
  const ratio = report.score.max ? Math.max(0, Math.min(1, report.score.value / report.score.max)) : 0;
  const degrees = ratio * 360;

  return {
    background: `conic-gradient(rgba(157,252,102,0.95) ${degrees}deg, rgba(255,255,255,0.08) ${degrees}deg 360deg)`
  };
}

function getAiStatus(report: AnalysisReport) {
  const enrichment = report.aiEnrichment;

  if (enrichment?.status === "error") {
    return {
      title: "OpenRouter AI enrichment failed",
      description:
        enrichment.summary ||
        "OpenRouter was attempted, but the app kept the deterministic report after an enrichment failure.",
      tone: "border-ember/30 bg-ember/10 text-ember",
      meta: [enrichment.provider, enrichment.model].filter(Boolean).join(" | ")
    };
  }

  if (enrichment?.available && enrichment.enabled) {
    return {
      title: "OpenRouter AI enrichment live",
      description:
        enrichment.summary ||
        "Free-model enrichment is active, layered on top of the deterministic core report.",
      tone: "border-lime/30 bg-lime/10 text-lime",
      meta: [enrichment.provider, enrichment.model].filter(Boolean).join(" | ")
    };
  }

  if (enrichment?.available) {
    return {
      title: "OpenRouter AI enrichment available",
      description:
        enrichment.summary ||
        "Free-model enrichment is reachable, but this report is still rendering a strong deterministic base readout.",
      tone: "border-cyan/20 bg-cyan/10 text-cyan",
      meta: [enrichment.provider, enrichment.model].filter(Boolean).join(" | ")
    };
  }

  return {
    title: "Deterministic report active",
    description:
      enrichment?.summary ||
      "AI enrichment is disabled or unavailable, so the product is using the deterministic report path only.",
    tone: "border-white/10 bg-white/5 text-ink",
    meta: enrichment?.provider || "OpenRouter free-model layer offline"
  };
}

function Panel({
  title,
  subtitle,
  children,
  className = ""
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`terminal-shell rounded-[28px] p-5 sm:p-6 ${className}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="terminal-heading">{title}</p>
          {subtitle ? <p className="mt-2 text-sm leading-6 text-mute">{subtitle}</p> : null}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function FactList({ items }: { items: AnalysisFact[] }) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm leading-6 text-mute">
        No structured items were returned for this section.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <div
          key={`${item.label}-${item.value}`}
          className={`rounded-2xl border p-4 ${toneClass(item.tone)}`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-white/90">{item.label}</p>
            <p className="terminal-number text-right text-sm font-semibold">{item.value}</p>
          </div>
          {item.detail ? <p className="mt-2 text-sm leading-6 text-mute">{item.detail}</p> : null}
        </div>
      ))}
    </div>
  );
}

function ScenarioList({ items }: { items: AnalysisScenario[] }) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm leading-6 text-mute">
        Scenario ranges were not included in this response yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((scenario) => (
        <div
          key={scenario.name}
          className="rounded-2xl border border-white/10 bg-white/5 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">{scenario.name}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-mute">
                Probability {scenario.probability}
              </p>
            </div>
            <div className="rounded-full border border-cyan/20 bg-cyan/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-cyan">
              {formatCurrency(scenario.marketCapLowUsd)} - {formatCurrency(scenario.marketCapHighUsd)}
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="terminal-heading">Market Cap Range</p>
              <p className="mt-2 terminal-number text-sm text-ink">
                {formatCurrency(scenario.marketCapLowUsd)} to {formatCurrency(scenario.marketCapHighUsd)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="terminal-heading">Expected Return Range</p>
              <p className="mt-2 terminal-number text-sm text-ink">
                {formatPercent(scenario.returnLowPct)} to {formatPercent(scenario.returnHighPct)}
              </p>
            </div>
          </div>

          <p className="mt-3 text-sm leading-6 text-mute">{scenario.summary}</p>
        </div>
      ))}
    </div>
  );
}

function RiskList({ items }: { items: AnalysisRisk[] }) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-cyan/20 bg-cyan/10 p-4 text-sm leading-6 text-ink">
        No critical risk warnings were returned. Treat the deterministic report as incomplete until the API supplies explicit breakers.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((risk) => (
        <div
          key={risk.title}
          className={`rounded-2xl border p-4 ${severityClass(risk.severity)}`}
        >
          <div className="flex items-center gap-2">
            <CircleAlert className="h-4 w-4" />
            <p className="text-sm font-semibold">{risk.title}</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-mute">{risk.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function ReportView({ report }: { report: AnalysisReport }) {
  const aiStatus = getAiStatus(report);
  const heroMetrics = [
    { label: "Price", value: formatCurrency(report.token.priceUsd) },
    { label: "MCap", value: formatCurrency(report.token.marketCapUsd) },
    { label: "Liquidity", value: formatCurrency(report.token.liquidityUsd) },
    { label: "24H Volume", value: formatCurrency(report.token.volume24hUsd) },
    {
      label: "Holders",
      value:
        report.token.holders !== null && report.token.holders !== undefined
          ? new Intl.NumberFormat("en-US", { notation: "compact" }).format(report.token.holders)
          : "N/A"
    },
    { label: "Updated", value: formatDate(report.updatedAt) }
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid gap-4 xl:grid-cols-[1.35fr,0.8fr]">
        <div className="order-2 xl:order-1">
          <Panel
            title="Setup Summary"
            subtitle="High-context readout for why this mint surfaced and what would break the setup."
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-cyan/20 bg-cyan/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan">
                {report.token.chain || "Solana"} / {report.token.symbol}
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-mute">
                Mint {report.mint.slice(0, 6)}...{report.mint.slice(-6)}
              </div>
              {report.token.launchedAt ? (
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-mute">
                  Launched {formatDate(report.token.launchedAt)}
                </div>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {heroMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <p className="terminal-heading">{metric.label}</p>
                  <p className="mt-2 terminal-number text-lg font-semibold text-ink">{metric.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-cyan">
                  <Radar className="h-4 w-4" />
                  <p className="terminal-heading text-cyan">Why it surfaced</p>
                </div>
                <p className="mt-3 text-sm leading-7 text-ink">{report.summary.whySurfaced}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-lime">
                  <Target className="h-4 w-4" />
                  <p className="terminal-heading text-lime">Trade setup</p>
                </div>
                <p className="mt-3 text-sm leading-7 text-ink">{report.summary.setup}</p>
              </div>
            </div>

            <div className="mt-4 rounded-[24px] border border-white/10 bg-black/20 p-4">
              <p className="terminal-heading">Narrative</p>
              <p className="mt-3 text-sm leading-7 text-ink">{report.summary.narrative}</p>
            </div>

            <div className="mt-4 rounded-[24px] border border-ember/20 bg-ember/10 p-4">
              <div className="flex items-center gap-2 text-ember">
                <CircleAlert className="h-4 w-4" />
                <p className="terminal-heading text-ember">What can break it</p>
              </div>
              <p className="mt-3 text-sm leading-7 text-ink">{report.summary.whatCanBreak}</p>
            </div>
          </Panel>
        </div>

        <div className="order-1 space-y-4 xl:order-2">
          <Panel
            title="Scorecard"
            subtitle="Keep the score, size tier, and time horizon above the fold on mobile."
          >
            <div className="flex items-center gap-5">
              <div
                style={scoreRing(report)}
                className="flex h-28 w-28 items-center justify-center rounded-full p-1"
              >
                <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[rgba(5,12,18,0.95)]">
                  <span className="terminal-number text-3xl font-semibold text-ink">
                    {Math.round(report.score.value)}
                  </span>
                  <span className="text-xs uppercase tracking-[0.2em] text-mute">
                    / {report.score.max}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="rounded-full border border-lime/25 bg-lime/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-lime">
                  {report.score.recommendation}
                </div>
                <p className="text-2xl font-semibold text-ink">{report.token.name}</p>
                <p className="text-sm leading-6 text-mute">
                  Confidence {report.score.confidence}
                  {report.score.percentile ? ` | ${report.score.percentile}` : ""}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-cyan">
                  <Activity className="h-4 w-4" />
                  <p className="terminal-heading text-cyan">Suggested size tier</p>
                </div>
                <p className="mt-2 text-sm font-semibold text-ink">{report.score.suggestedSizeTier}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-cyan">
                  <Clock3 className="h-4 w-4" />
                  <p className="terminal-heading text-cyan">Time horizon</p>
                </div>
                <p className="mt-2 text-sm font-semibold text-ink">{report.score.timeHorizon}</p>
              </div>
            </div>

            <div className={`mt-3 rounded-2xl border p-4 ${aiStatus.tone}`}>
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                <p className="terminal-heading !text-current">AI enrichment</p>
              </div>
              <p className="mt-2 text-sm font-semibold">{aiStatus.title}</p>
              <p className="mt-2 text-sm leading-6 text-mute">{aiStatus.description}</p>
              {aiStatus.meta ? (
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/70">{aiStatus.meta}</p>
              ) : null}
            </div>
          </Panel>

          <Panel
            title="Risk Warnings"
            subtitle="Fast-glance breakers and security concerns."
          >
            <RiskList items={report.risks} />
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr,0.95fr,1.1fr]">
        <Panel title="Facts" subtitle="Observed metrics and holder profile anchors.">
          <FactList items={report.facts} />
        </Panel>

        <Panel title="Signals" subtitle="Interpreted quality signals worth watching intraday.">
          <FactList items={report.signals} />
        </Panel>

        <Panel title="Scenario Ranges" subtitle="Base, upside, and failure-case market cap windows.">
          <ScenarioList items={report.scenarios} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr,0.95fr,1.1fr]">
        <Panel title="Holder Breakdown" subtitle="Wallet concentration, freshness, and ownership texture.">
          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-cyan">
                <Users className="h-4 w-4" />
                <p className="terminal-heading text-cyan">Holder structure</p>
              </div>
              <p className="mt-3 text-sm font-semibold text-ink">{report.holders.concentration}</p>
              <p className="mt-2 text-sm leading-6 text-mute">{report.holders.commentary}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="terminal-heading">Top 10 share</p>
                <p className="mt-2 terminal-number text-lg text-ink">
                  {formatPercent(report.holders.top10SharePct)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="terminal-heading">Fresh wallet share</p>
                <p className="mt-2 terminal-number text-lg text-ink">
                  {formatPercent(report.holders.freshWalletSharePct)}
                </p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Bundle + Security" subtitle="Execution friction, mint controls, and LP posture.">
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-cyan">
                <Waypoints className="h-4 w-4" />
                <p className="terminal-heading text-cyan">Bundle status</p>
              </div>
              <p className="mt-3 text-sm font-semibold text-ink">
                {report.bundles.status}
                {report.bundles.bundleCount !== null && report.bundles.bundleCount !== undefined
                  ? ` | ${report.bundles.bundleCount} flagged cluster${report.bundles.bundleCount === 1 ? "" : "s"}`
                  : ""}
              </p>
              <p className="mt-2 text-sm leading-6 text-mute">{report.bundles.commentary}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-cyan">
                <Shield className="h-4 w-4" />
                <p className="terminal-heading text-cyan">Security</p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="terminal-heading">Mint authority</p>
                  <p className="mt-2 text-sm text-ink">{report.security.mintAuthority}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="terminal-heading">Freeze authority</p>
                  <p className="mt-2 text-sm text-ink">{report.security.freezeAuthority}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="terminal-heading">LP status</p>
                  <p className="mt-2 text-sm text-ink">{report.security.lpStatus}</p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-mute">{report.security.commentary}</p>
            </div>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Bubble Map" subtitle="Embed the ownership graph when the API supplies a URL.">
            {report.bubbleMap?.url ? (
              <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/30">
                <iframe
                  title={`Bubble map for ${report.token.symbol}`}
                  src={report.bubbleMap.url}
                  loading="lazy"
                  className="h-[360px] w-full"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 p-6 text-sm leading-6 text-mute">
                Bubble map iframe not supplied for this report yet.
              </div>
            )}

            {report.bubbleMap?.caption ? (
              <p className="mt-3 text-sm leading-6 text-mute">{report.bubbleMap.caption}</p>
            ) : null}
          </Panel>

          <Panel title="Sources" subtitle="Direct links behind the report object and supporting checks.">
            {report.sources.length ? (
              <div className="space-y-3">
                {report.sources.map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-cyan/35 hover:bg-white/[0.07]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">{source.label}</p>
                      {source.note ? <p className="mt-1 text-sm leading-6 text-mute">{source.note}</p> : null}
                    </div>
                    <div className="mt-1 inline-flex items-center gap-1 text-sm text-cyan">
                      Open
                      <ExternalLink className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 p-6 text-sm leading-6 text-mute">
                No source links are available for this response yet.
              </div>
            )}
          </Panel>
        </div>
      </div>

      <div className="terminal-shell rounded-[28px] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="terminal-heading">Routing notes</p>
            <p className="mt-2 text-sm leading-6 text-mute">
              Use the home route for quick discovery or keep drilling through token routes when you are comparing setups.
            </p>
          </div>
          <a
            href={`/token/${encodeURIComponent(report.mint)}`}
            className="inline-flex items-center gap-2 rounded-2xl border border-cyan/20 bg-cyan/10 px-4 py-3 text-sm font-medium text-cyan transition hover:border-cyan/40"
          >
            Open dedicated token route
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
