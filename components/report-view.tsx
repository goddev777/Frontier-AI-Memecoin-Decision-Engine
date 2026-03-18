import {
  Activity,
  ArrowUpRight,
  Bot,
  CircleAlert,
  Clock3,
  Radar,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Waypoints
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

function formatCompactNumber(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1_000 ? 1 : 0
  }).format(value);
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
      return "border-lime/20 bg-lime/[0.12]";
    case "negative":
      return "border-ember/20 bg-ember/[0.11]";
    case "caution":
      return "border-amber-300/20 bg-amber-300/[0.08]";
    default:
      return "border-white/10 bg-white/[0.04]";
  }
}

function toneAccentClass(tone?: AnalysisFact["tone"]) {
  switch (tone) {
    case "positive":
      return "text-lime";
    case "negative":
      return "text-ember";
    case "caution":
      return "text-amber-200";
    default:
      return "text-cyan";
  }
}

function severityClass(severity: AnalysisRisk["severity"]) {
  switch (severity) {
    case "high":
      return "border-ember/25 bg-ember/[0.12]";
    case "medium":
      return "border-amber-300/20 bg-amber-300/[0.08]";
    default:
      return "border-cyan/20 bg-cyan/[0.1]";
  }
}

function scoreRing(report: AnalysisReport) {
  const ratio = report.score.max ? Math.max(0, Math.min(1, report.score.value / report.score.max)) : 0;
  const degrees = ratio * 360;

  return {
    background: `conic-gradient(rgba(157,252,102,0.98) ${degrees}deg, rgba(88,230,255,0.7) ${Math.min(
      degrees + 18,
      360
    )}deg, rgba(255,255,255,0.08) ${Math.min(degrees + 18, 360)}deg 360deg)`
  };
}

function getAiStatus(report: AnalysisReport) {
  const enrichment = report.aiEnrichment;

  if (enrichment?.status === "error") {
    return {
      title: "AI narrative layer failed",
      description:
        enrichment.summary ||
        "OpenRouter was attempted, but the report kept the deterministic readout after enrichment failed.",
      tone: "border-ember/25 bg-ember/[0.11] text-ember",
      meta: [enrichment.provider, enrichment.model].filter(Boolean).join(" | ")
    };
  }

  if (enrichment?.available && enrichment.enabled) {
    return {
      title: "AI narrative layer live",
      description:
        enrichment.summary ||
        "OpenRouter enrichment is active on top of the deterministic scoring and scenario engine.",
      tone: "border-lime/20 bg-lime/[0.11] text-lime",
      meta: [enrichment.provider, enrichment.model].filter(Boolean).join(" | ")
    };
  }

  if (enrichment?.available) {
    return {
      title: "AI layer reachable",
      description:
        enrichment.summary ||
        "OpenRouter is configured, but this view is still primarily leaning on the deterministic report path.",
      tone: "border-cyan/20 bg-cyan/[0.1] text-cyan",
      meta: [enrichment.provider, enrichment.model].filter(Boolean).join(" | ")
    };
  }

  return {
    title: "Deterministic mode only",
    description:
      enrichment?.summary ||
      "AI enrichment is disabled or unavailable, so this report is driven entirely by deterministic provider analysis.",
    tone: "border-white/10 bg-white/[0.05] text-ink",
    meta: enrichment?.provider || "OpenRouter layer offline"
  };
}

function Panel({
  title,
  subtitle,
  action,
  children,
  className = ""
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`terminal-shell rounded-[32px] p-5 sm:p-6 ${className}`.trim()}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="terminal-heading">{title}</p>
          {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-6 text-mute">{subtitle}</p> : null}
        </div>
        {action ? <div className="sm:shrink-0">{action}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function HeroStat({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
      <p className="terminal-heading">{label}</p>
      <p className="mt-2 terminal-number text-lg font-semibold text-ink sm:text-xl">{value}</p>
      {detail ? <p className="mt-2 text-xs uppercase tracking-[0.16em] text-mute">{detail}</p> : null}
    </div>
  );
}

function InsightCard({
  icon: Icon,
  title,
  body,
  tone = "default"
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  tone?: "default" | "cyan" | "lime" | "ember";
}) {
  const toneClassName =
    tone === "lime"
      ? "border-lime/20 bg-lime/[0.11]"
      : tone === "ember"
        ? "border-ember/20 bg-ember/[0.11]"
        : tone === "cyan"
          ? "border-cyan/20 bg-cyan/[0.1]"
          : "border-white/10 bg-white/[0.05]";

  const iconTone =
    tone === "lime" ? "text-lime" : tone === "ember" ? "text-ember" : tone === "cyan" ? "text-cyan" : "text-ink";

  return (
    <div className={`rounded-[26px] border p-4 ${toneClassName}`}>
      <div className={`flex items-center gap-2 ${iconTone}`}>
        <Icon className="h-4 w-4" />
        <p className="terminal-heading !text-current">{title}</p>
      </div>
      <p className="mt-3 text-sm leading-7 text-ink">{body}</p>
    </div>
  );
}

function FactList({ items }: { items: AnalysisFact[] }) {
  if (!items.length) {
    return (
      <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 p-4 text-sm leading-6 text-mute">
        No structured items were returned for this section.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`} className={`rounded-[24px] border p-4 ${toneClass(item.tone)}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`terminal-heading ${toneAccentClass(item.tone)}`}>{item.label}</p>
              <p className="mt-2 terminal-number text-lg font-semibold text-ink">{item.value}</p>
            </div>
          </div>
          {item.detail ? <p className="mt-3 text-sm leading-6 text-mute">{item.detail}</p> : null}
        </div>
      ))}
    </div>
  );
}

function ScenarioList({ items }: { items: AnalysisScenario[] }) {
  if (!items.length) {
    return (
      <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 p-4 text-sm leading-6 text-mute">
        Scenario ranges were not included in this response yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((scenario) => (
        <div
          key={scenario.name}
          className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(88,230,255,0.08),rgba(255,255,255,0.03))] p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-ink">{scenario.name}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan">Probability {scenario.probability}</p>
            </div>
            <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs uppercase tracking-[0.16em] text-mute">
              {formatCurrency(scenario.marketCapLowUsd)} to {formatCurrency(scenario.marketCapHighUsd)}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[20px] border border-white/10 bg-black/20 p-3">
              <p className="terminal-heading">Market Cap</p>
              <p className="mt-2 terminal-number text-sm text-ink">
                {formatCurrency(scenario.marketCapLowUsd)} to {formatCurrency(scenario.marketCapHighUsd)}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-black/20 p-3">
              <p className="terminal-heading">Return Range</p>
              <p className="mt-2 terminal-number text-sm text-ink">
                {formatPercent(scenario.returnLowPct)} to {formatPercent(scenario.returnHighPct)}
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-mute">{scenario.summary}</p>
        </div>
      ))}
    </div>
  );
}

function RiskList({ items }: { items: AnalysisRisk[] }) {
  if (!items.length) {
    return (
      <div className="rounded-[24px] border border-cyan/20 bg-cyan/[0.1] p-4 text-sm leading-6 text-ink">
        No explicit breakers were returned. Treat this as incomplete coverage rather than a clean bill of health.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((risk) => (
        <div key={risk.title} className={`rounded-[24px] border p-4 ${severityClass(risk.severity)}`}>
          <div className="flex items-center gap-2">
            <CircleAlert className="h-4 w-4" />
            <p className="text-sm font-semibold text-ink">{risk.title}</p>
          </div>
          <p className="mt-3 text-sm leading-6 text-mute">{risk.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function ReportView({ report }: { report: AnalysisReport }) {
  const aiStatus = getAiStatus(report);
  const heroMetrics = [
    {
      label: "Price",
      value: formatCurrency(report.token.priceUsd)
    },
    {
      label: "Market Cap",
      value: formatCurrency(report.token.marketCapUsd)
    },
    {
      label: "Liquidity",
      value: formatCurrency(report.token.liquidityUsd)
    },
    {
      label: "24H Volume",
      value: formatCurrency(report.token.volume24hUsd)
    },
    {
      label: "Holders",
      value: formatCompactNumber(report.token.holders)
    },
    {
      label: "Last Sync",
      value: formatDate(report.updatedAt)
    }
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="terminal-shell overflow-hidden rounded-[36px] p-5 sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(88,230,255,0.16),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(157,252,102,0.12),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_38%)]" />
        <div className="relative grid gap-5 xl:grid-cols-[1.2fr,0.8fr]">
          <div className="order-2 space-y-5 xl:order-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-cyan/20 bg-cyan/[0.12] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-cyan">
                {report.token.chain || "Solana"} / {report.token.symbol}
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-mute">
                Mint {report.mint.slice(0, 6)}...{report.mint.slice(-6)}
              </div>
              {report.token.launchedAt ? (
                <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-mute">
                  Launched {formatDate(report.token.launchedAt)}
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="terminal-heading text-cyan">Live trench readout</p>
                  <h2 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-balance text-ink sm:text-5xl">
                    {report.token.name}
                  </h2>
                  <p className="mt-3 text-base leading-7 text-mute sm:text-[1.02rem]">{report.summary.setup}</p>
                </div>

                <a
                  href={`/token/${encodeURIComponent(report.mint)}`}
                  className="inline-flex items-center gap-2 rounded-[20px] border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-ink transition hover:border-cyan/35 hover:text-cyan"
                >
                  Open token route
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {heroMetrics.map((metric) => (
                  <HeroStat key={metric.label} label={metric.label} value={metric.value} />
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
              <InsightCard icon={Sparkles} title="Narrative pulse" body={report.summary.narrative} tone="default" />

              <div className="grid gap-4">
                <InsightCard icon={Radar} title="Why it surfaced" body={report.summary.whySurfaced} tone="cyan" />
                <InsightCard icon={CircleAlert} title="What can break it" body={report.summary.whatCanBreak} tone="ember" />
              </div>
            </div>
          </div>

          <div className="order-1 space-y-4 xl:order-2">
            <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(8,12,18,0.94))] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="terminal-heading text-cyan">Action bias</p>
                  <div className="mt-3 inline-flex rounded-full border border-lime/20 bg-lime/[0.12] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-lime">
                    {report.score.recommendation}
                  </div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs uppercase tracking-[0.18em] text-mute">
                  {report.score.confidence}
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
                <div style={scoreRing(report)} className="flex h-28 w-28 items-center justify-center rounded-full p-1">
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[rgba(6,11,18,0.98)]">
                    <span className="terminal-number text-3xl font-semibold text-ink">{Math.round(report.score.value)}</span>
                    <span className="text-xs uppercase tracking-[0.2em] text-mute">/ {report.score.max}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-2xl font-semibold text-ink">{report.token.symbol}</p>
                    <p className="mt-1 text-sm leading-6 text-mute">
                      {report.score.percentile ? `${report.score.percentile} percentile` : "Percentile unavailable"}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[20px] border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center gap-2 text-lime">
                        <Activity className="h-4 w-4" />
                        <p className="terminal-heading !text-current">Size tier</p>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-ink">{report.score.suggestedSizeTier}</p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center gap-2 text-white/80">
                        <Clock3 className="h-4 w-4" />
                        <p className="terminal-heading !text-current">Horizon</p>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-ink">{report.score.timeHorizon}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[20px] border border-white/10 bg-white/[0.05] p-3">
                  <p className="terminal-heading">Risk level</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{report.score.riskLevel.toUpperCase()}</p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-white/[0.05] p-3">
                  <p className="terminal-heading">Concentration</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{report.bundles.status}</p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-white/[0.05] p-3">
                  <p className="terminal-heading">AI mode</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{aiStatus.title}</p>
                </div>
              </div>
            </div>

            <div className={`rounded-[28px] border p-4 ${aiStatus.tone}`}>
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                <p className="terminal-heading !text-current">AI enrichment</p>
              </div>
              <p className="mt-3 text-lg font-semibold text-ink">{aiStatus.title}</p>
              <p className="mt-2 text-sm leading-6 text-mute">{aiStatus.description}</p>
              {aiStatus.meta ? <p className="mt-3 text-xs uppercase tracking-[0.18em] text-white/70">{aiStatus.meta}</p> : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <InsightCard icon={Target} title="Trade framing" body={report.summary.setup} tone="lime" />
              <InsightCard icon={TrendingUp} title="Holder posture" body={report.holders.commentary} tone="default" />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.95fr,0.95fr,1.1fr]">
        <Panel title="Facts" subtitle="Observed metrics and hard anchors from the provider mix.">
          <FactList items={report.facts} />
        </Panel>

        <Panel title="Signals" subtitle="Interpreted quality tells worth watching as the setup evolves.">
          <FactList items={report.signals} />
        </Panel>

        <Panel title="Scenario map" subtitle="Bull, base, and failure-case market-cap windows for quick sizing.">
          <ScenarioList items={report.scenarios} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr,1.05fr]">
        <Panel
          title="Risk board"
          subtitle="Breakers and caution flags stay close to the thesis so skips are faster."
          action={
            <div className="rounded-full border border-ember/20 bg-ember/[0.1] px-3 py-1 text-xs uppercase tracking-[0.18em] text-ember">
              Review before entry
            </div>
          }
        >
          <RiskList items={report.risks} />
        </Panel>

        <Panel title="Holder structure" subtitle="Concentration, freshness, and wallet texture around the mint.">
          <div className="space-y-3">
            <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4">
              <div className="flex items-center gap-2 text-cyan">
                <Users className="h-4 w-4" />
                <p className="terminal-heading !text-current">Ownership read</p>
              </div>
              <p className="mt-3 text-lg font-semibold text-ink">{report.holders.concentration}</p>
              <p className="mt-2 text-sm leading-6 text-mute">{report.holders.commentary}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                <p className="terminal-heading">Top 10 Share</p>
                <p className="mt-2 terminal-number text-xl text-ink">{formatPercent(report.holders.top10SharePct)}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                <p className="terminal-heading">Fresh Wallet Share</p>
                <p className="mt-2 terminal-number text-xl text-ink">{formatPercent(report.holders.freshWalletSharePct)}</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4">
        <Panel title="Concentration + Security" subtitle="Execution friction, concentration proxy risk, and mint controls in one place.">
          <div className="space-y-3">
            <div className="rounded-[26px] border border-white/10 bg-white/[0.05] p-4">
              <div className="flex items-center gap-2 text-cyan">
                <Waypoints className="h-4 w-4" />
                <p className="terminal-heading !text-current">Concentration proxy</p>
              </div>
              <p className="mt-3 text-lg font-semibold text-ink">
                {report.bundles.status}
                {report.bundles.bundleCount !== null && report.bundles.bundleCount !== undefined
                  ? ` | ${report.bundles.bundleCount} flagged cluster${report.bundles.bundleCount === 1 ? "" : "s"}`
                  : ""}
              </p>
              <p className="mt-2 text-sm leading-6 text-mute">{report.bundles.commentary}</p>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/[0.05] p-4">
              <div className="flex items-center gap-2 text-cyan">
                <Shield className="h-4 w-4" />
                <p className="terminal-heading !text-current">Security posture</p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[20px] border border-white/10 bg-black/20 p-3">
                  <p className="terminal-heading">Mint Authority</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{report.security.mintAuthority}</p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-black/20 p-3">
                  <p className="terminal-heading">Freeze Authority</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{report.security.freezeAuthority}</p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-black/20 p-3">
                  <p className="terminal-heading">LP Status</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{report.security.lpStatus}</p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-mute">{report.security.commentary}</p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
