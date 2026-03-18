import type { AnalysisReport as UiAnalysisReport, AnalysisFact, AnalysisRisk, AnalysisScenario, AnalysisSource } from "@/lib/types";

import type {
  AnalysisMetricScore,
  AnalysisReport as EngineAnalysisReport,
  AnalysisWarning,
  ProviderSnapshot,
  SourceAttribution
} from "./types";

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatCurrency(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 1 ? 2 : 4
  }).format(value);
}

function formatPercent(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "N/A";
  }

  return `${round(value, 1)}%`;
}

function compact(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function holderVisibilityDetail(report: EngineAnalysisReport) {
  if (report.distribution.holderCount !== undefined) {
    return `${compact(report.distribution.holderCount)} holders were surfaced in the available dataset.`;
  }

  if (report.distribution.sampledHolderCount !== undefined) {
    return `Total holder count is unknown, but RPC surfaced ${compact(report.distribution.sampledHolderCount)} large token accounts for concentration checks.`;
  }

  return "Holder count is only partially visible.";
}

function toneFromScore(score: number): AnalysisFact["tone"] {
  if (score >= 72) {
    return "positive";
  }
  if (score >= 52) {
    return "neutral";
  }
  if (score >= 36) {
    return "caution";
  }
  return "negative";
}

function recommendationLabel(value: EngineAnalysisReport["recommendation"]["label"]) {
  switch (value) {
    case "constructive":
      return "BUY";
    case "speculative":
      return "BUY / WATCH";
    case "watch":
      return "SKIP / WATCH";
    default:
      return "SELL / AVOID";
  }
}

function riskLevel(report: EngineAnalysisReport): UiAnalysisReport["score"]["riskLevel"] {
  if (!report.isValid) {
    return "high";
  }

  if (
    report.security.mintable ||
    report.security.freezable ||
    (report.distribution.top10HolderPct ?? 0) >= 55
  ) {
    return "high";
  }

  if ((report.distribution.top10HolderPct ?? 0) >= 35 || report.scores.overall < 65) {
    return "medium";
  }

  return "low";
}

function sizeTier(report: EngineAnalysisReport) {
  if (!report.isValid) {
    return "No size";
  }

  if (report.recommendation.label === "constructive") {
    return report.scores.confidence === "high" ? "Starter to standard size" : "Starter size only";
  }
  if (report.recommendation.label === "speculative") {
    return "Pilot size only";
  }
  if (report.recommendation.label === "watch") {
    return "Watchlist only";
  }
  return "Avoid size until structure improves";
}

function timeHorizon(report: EngineAnalysisReport) {
  if (!report.isValid) {
    return "Validation required";
  }

  const volume = report.market.volume24hUsd ?? 0;
  const liquidity = report.market.liquidityUsd ?? 0;
  const ratio = liquidity > 0 ? volume / liquidity : 0;

  if (ratio >= 2) {
    return "6h to 24h momentum window";
  }
  if (ratio >= 0.8) {
    return "1d to 3d continuation window";
  }
  return "3d to 7d confirmation window";
}

function buildFacts(report: EngineAnalysisReport): AnalysisFact[] {
  return [
    {
      label: "Pair + venue",
      value: report.market.selectedPair?.dexId?.toUpperCase() ?? "Unclear",
      detail: report.market.selectedPair?.url
        ? "Primary pair surfaced via DexScreener."
        : "No dominant pair was confirmed.",
      tone: report.market.selectedPair ? "positive" : "caution"
    },
    {
      label: "Liquidity",
      value: formatCurrency(report.market.liquidityUsd),
      detail: report.scores.liquidity.explanation,
      tone: toneFromScore(report.scores.liquidity.value)
    },
    {
      label: "24h volume",
      value: formatCurrency(report.market.volume24hUsd),
      detail: report.market.priceChange24hPct !== undefined
        ? `24h price change is ${formatPercent(report.market.priceChange24hPct)}.`
        : "24h price change is not available.",
      tone: toneFromScore(report.scores.activity.value)
    },
    {
      label: "Holders",
      value:
        report.distribution.holderCount !== undefined
          ? compact(report.distribution.holderCount)
          : report.distribution.sampledHolderCount !== undefined
            ? `${compact(report.distribution.sampledHolderCount)} sampled`
            : "N/A",
      detail: holderVisibilityDetail(report),
      tone: report.distribution.holderCount && report.distribution.holderCount > 2_000 ? "positive" : "neutral"
    },
    {
      label: "Top 10 concentration",
      value: formatPercent(report.distribution.top10HolderPct),
      detail:
        report.distribution.top10HolderPct !== undefined
          ? `Top wallets control ${formatPercent(report.distribution.top10HolderPct)} of visible supply.`
          : "Top holder concentration is incomplete.",
      tone: toneFromScore(100 - (report.distribution.top10HolderPct ?? 50))
    },
    {
      label: "Contract controls",
      value:
        report.security.mintable === undefined && report.security.freezable === undefined
          ? "Unknown"
          : report.security.mintable || report.security.freezable
          ? "Active"
          : "Renounced / inactive",
      detail: report.scores.trust.explanation,
      tone:
        report.security.mintable === undefined && report.security.freezable === undefined
          ? "caution"
          : report.security.mintable || report.security.freezable
            ? "negative"
            : "positive"
    }
  ];
}

function metricSignal(label: string, metric: AnalysisMetricScore): AnalysisFact {
  return {
    label,
    value: `${round(metric.value, 1)}/100`,
    detail: metric.explanation,
    tone: toneFromScore(metric.value)
  };
}

function buildSignals(report: EngineAnalysisReport): AnalysisFact[] {
  return [
    metricSignal("Liquidity score", report.scores.liquidity),
    metricSignal("Activity score", report.scores.activity),
    metricSignal("Distribution score", report.scores.distribution),
    metricSignal("Trust score", report.scores.trust),
    {
      label: "Coverage",
      value: `${Math.round(report.scores.completeness * 100)}%`,
      detail:
        report.scores.confidence === "high"
          ? "Coverage is broad enough to support a firmer read."
          : report.scores.confidence === "medium"
            ? "Coverage is directionally useful but still partial."
            : "Coverage is thin, so strong conclusions are intentionally avoided.",
      tone:
        report.scores.confidence === "high"
          ? "positive"
          : report.scores.confidence === "medium"
            ? "neutral"
            : "caution"
    }
  ];
}

function sourceLabel(provider: SourceAttribution["provider"]) {
  switch (provider) {
    case "dexscreener":
      return "DexScreener";
    case "birdeye":
      return "Birdeye";
    case "helius":
      return "Helius";
    case "solana-rpc":
      return "Solana RPC";
    case "bubblemaps":
      return "Bubblemaps";
    case "openrouter":
      return "OpenRouter";
    default:
      return provider;
  }
}

function sourceUrl(source: SourceAttribution, report: EngineAnalysisReport, snapshot: ProviderSnapshot) {
  if (source.provider === "dexscreener") {
    return report.market.selectedPair?.url || source.url || "https://docs.dexscreener.com/api/reference";
  }
  if (source.provider === "bubblemaps") {
    return snapshot.bubblemaps?.explorerUrl || source.url || "https://docs.bubblemaps.io";
  }
  if (source.provider === "helius") {
    return source.url || "https://www.helius.dev/docs/das-api";
  }
  if (source.provider === "birdeye") {
    return source.url || "https://docs.birdeye.so";
  }
  if (source.provider === "openrouter") {
    return "https://openrouter.ai/docs/";
  }
  return source.url || "https://solana.com/docs/rpc";
}

function buildSources(report: EngineAnalysisReport, snapshot: ProviderSnapshot): AnalysisSource[] {
  return report.sources.map((source) => ({
    label: sourceLabel(source.provider),
    url: sourceUrl(source, report, snapshot),
    note:
      source.status === "success"
        ? source.note || "Used in the final report."
        : source.note || `Status: ${source.status}.`
  }));
}

function buildRisks(report: EngineAnalysisReport): AnalysisRisk[] {
  const mappedWarnings = report.warnings.map((warning) => ({
    title: warning.code.replaceAll("_", " "),
    detail: warning.message,
    severity:
      warning.severity === "critical"
        ? "high"
        : warning.severity === "warning"
          ? "medium"
          : "low"
  })) satisfies AnalysisRisk[];

  const caveats = report.recommendation.caveats.map((detail) => ({
    title: "Trading caveat",
    detail,
    severity: /active|caution|concentration|limited/i.test(detail) ? "medium" : "low"
  })) satisfies AnalysisRisk[];

  const unique = new Map<string, AnalysisRisk>();
  [...mappedWarnings, ...caveats].forEach((risk) => {
    const key = `${risk.title}-${risk.detail}`;
    if (!unique.has(key)) {
      unique.set(key, risk);
    }
  });

  return [...unique.values()].slice(0, 8);
}

function buildScenarios(report: EngineAnalysisReport): AnalysisScenario[] {
  const currentMarketCap =
    report.market.marketCapUsd ?? report.market.fullyDilutedValuationUsd ?? undefined;

  return report.scenarios.map((scenario) => {
    const center = scenario.impliedMarketCapUsd ?? currentMarketCap;
    const multiplier = scenario.name === "bear" ? 0.08 : scenario.name === "base" ? 0.12 : 0.18;
    const low = center !== undefined ? round(center * (1 - multiplier), 2) : null;
    const high = center !== undefined ? round(center * (1 + multiplier), 2) : null;
    const returnLowPct =
      currentMarketCap && low !== null ? round(((low - currentMarketCap) / currentMarketCap) * 100, 1) : null;
    const returnHighPct =
      currentMarketCap && high !== null ? round(((high - currentMarketCap) / currentMarketCap) * 100, 1) : null;

    return {
      name: scenario.name.toUpperCase(),
      probability:
        scenario.name === "base" ? "Most likely" : scenario.name === "bull" ? "Momentum expands" : "Protect capital",
      marketCapLowUsd: low,
      marketCapHighUsd: high,
      returnLowPct,
      returnHighPct,
      summary: scenario.description
    };
  });
}

function bundleStatus(report: EngineAnalysisReport, snapshot: ProviderSnapshot) {
  const clusterCount = snapshot.bubblemaps?.apiData?.clusters?.length;
  const top10 = report.distribution.top10HolderPct ?? 0;
  const largestHolder = report.distribution.largestHolderPct ?? 0;
  const usingProxy = clusterCount === undefined;

  if (
    !report.isValid ||
    (clusterCount === undefined &&
      report.distribution.top10HolderPct === undefined &&
      report.distribution.largestHolderPct === undefined)
  ) {
    return "Bundle data unavailable";
  }

  if ((clusterCount ?? 0) >= 6 || top10 >= 55 || largestHolder >= 18) {
    return usingProxy ? "High concentration proxy risk" : "High cluster / bundle risk";
  }
  if ((clusterCount ?? 0) >= 3 || top10 >= 35 || largestHolder >= 10) {
    return usingProxy ? "Medium concentration proxy risk" : "Medium bundle risk";
  }
  return usingProxy ? "Low concentration proxy risk" : "Low bundle risk";
}

function lpStatus(report: EngineAnalysisReport) {
  const liquidity = report.market.liquidityUsd ?? 0;
  if (liquidity >= 250_000) {
    return "Deep enough for active trench flow";
  }
  if (liquidity >= 75_000) {
    return "Tradable but still slippy";
  }
  return "Thin exit liquidity";
}

function aiEnrichment(report: EngineAnalysisReport): UiAnalysisReport["aiEnrichment"] {
  const source = report.sources.find((item) => item.provider === "openrouter");
  if (!source) {
    return {
      available: false,
      enabled: false,
      provider: "OpenRouter",
      status: "unavailable",
      summary: "OpenRouter enrichment did not run for this report."
    };
  }

  const model = source.note?.startsWith("Model:") ? source.note.replace("Model:", "").trim() : undefined;
  const noteSummary = source.note?.startsWith("Model:") ? undefined : source.note;
  if (source.status === "success") {
    return {
      available: true,
      enabled: true,
      provider: "OpenRouter",
      model,
      status: "available",
      summary: "Free-model enrichment is layered on top of the deterministic report.",
      updatedAt: report.analyzedAt
    };
  }

  if (source.status === "skipped") {
    return {
      available: false,
      enabled: false,
      provider: "OpenRouter",
      model,
      status: "unavailable",
      summary: noteSummary || "OpenRouter is not configured, so only deterministic analysis is active.",
      updatedAt: report.analyzedAt
    };
  }

  if (source.status === "error") {
    return {
      available: false,
      enabled: false,
      provider: "OpenRouter",
      model,
      status: "error",
      summary: noteSummary || "OpenRouter enrichment failed, so the deterministic report remained in place.",
      updatedAt: report.analyzedAt
    };
  }

  return {
    available: true,
    enabled: false,
    provider: "OpenRouter",
    model,
    status: "disabled",
    summary: noteSummary || "OpenRouter was reachable, but its output was slow or empty so the deterministic report stayed primary.",
    updatedAt: report.analyzedAt
  };
}

export function toUiAnalysisReport(
  report: EngineAnalysisReport,
  snapshot: ProviderSnapshot
): UiAnalysisReport {
  const recommendation = recommendationLabel(report.recommendation.label);
  const clusterCount = snapshot.bubblemaps?.apiData?.clusters?.length ?? null;
  const notableWalletSummary = report.distribution.notableWallets.length
    ? report.distribution.notableWallets
        .slice(0, 3)
        .map((wallet) => `${wallet.label}: ${wallet.summary}`)
        .join(" ")
    : "No standout holder or trader wallet surfaced strongly enough to summarize.";
  const holderConcentration =
    report.distribution.top10HolderPct !== undefined
      ? report.distribution.holderCount !== undefined
        ? `Top 10 wallets hold ${formatPercent(report.distribution.top10HolderPct)} of visible supply.`
        : `Top 10 visible token accounts hold ${formatPercent(report.distribution.top10HolderPct)} of reported supply in the RPC sample.`
      : report.distribution.largestHolderPct !== undefined
        ? `Largest visible token account holds ${formatPercent(report.distribution.largestHolderPct)} of supply in the RPC sample.`
        : "Holder concentration is only partially visible.";
  const holderCommentary =
    report.distribution.holderCount === undefined && report.distribution.sampledHolderCount !== undefined
      ? `${notableWalletSummary} RPC holder sampling is active, but total holder count is still unknown without a fuller indexer.`
      : notableWalletSummary;
  const bundleCommentary = clusterCount
    ? `${clusterCount} holder clusters were surfaced by Bubblemaps.`
    : report.distribution.top10HolderPct !== undefined || report.distribution.largestHolderPct !== undefined
      ? "Bubblemaps API is unavailable, so bundle risk is estimated from RPC largest-account concentration instead of true cluster mapping."
      : "No direct bundle or concentration sample was available.";

  return {
    mint: report.address,
    token: {
      name: report.token.name || "Unknown token",
      symbol: report.token.symbol || "UNKNOWN",
      chain: "Solana",
      launchedAt: undefined,
      priceUsd: report.market.priceUsd ?? null,
      marketCapUsd: report.market.marketCapUsd ?? report.market.fullyDilutedValuationUsd ?? null,
      liquidityUsd: report.market.liquidityUsd ?? null,
      volume24hUsd: report.market.volume24hUsd ?? null,
      holders: report.distribution.holderCount ?? null
    },
    score: {
      value: report.scores.overall,
      max: 100,
      percentile:
        report.scores.confidence === "high"
          ? "High coverage"
          : report.scores.confidence === "medium"
            ? "Medium coverage"
            : "Low coverage",
      recommendation,
      confidence: report.scores.confidence.toUpperCase(),
      suggestedSizeTier: sizeTier(report),
      timeHorizon: timeHorizon(report),
      riskLevel: riskLevel(report)
    },
    summary: {
      setup: report.recommendation.summary,
      whySurfaced: report.recommendation.rationale.slice(0, 2).join(" "),
      narrative: report.narrative,
      whatCanBreak: (
        report.recommendation.caveats.join(" ") ||
        buildRisks(report)
          .slice(0, 2)
          .map((risk) => risk.detail)
          .join(" ") ||
        "Fresh Solana memecoin structure can break quickly on thin liquidity, concentrated holders, or disappearing momentum."
      )
    },
    facts: buildFacts(report),
    signals: buildSignals(report),
    scenarios: buildScenarios(report),
    risks: buildRisks(report),
    holders: {
      concentration: holderConcentration,
      top10SharePct: report.distribution.top10HolderPct ?? null,
      freshWalletSharePct: null,
      commentary: holderCommentary
    },
    bundles: {
      status: bundleStatus(report, snapshot),
      bundleCount: clusterCount,
      commentary: bundleCommentary
    },
    security: {
      mintAuthority:
        report.security.mintable === undefined ? "Unknown" : report.security.mintable ? "Active" : "Inactive / renounced",
      freezeAuthority:
        report.security.freezable === undefined ? "Unknown" : report.security.freezable ? "Active" : "Inactive / renounced",
      lpStatus:
        report.market.liquidityUsd === undefined ? "Unknown / incomplete" : lpStatus(report),
      commentary: report.scores.trust.explanation
    },
    aiEnrichment: aiEnrichment(report),
    sources: buildSources(report, snapshot),
    bubbleMap: {
      url: snapshot.bubblemaps?.embedUrl,
      caption: snapshot.bubblemaps?.embedUrl
        ? "Bubblemap iframe is live when partner access is configured; otherwise use the linked source for the external map."
        : "Bubblemap external view is available through the Bubblemaps source link.",
      provider: "Bubblemaps"
    },
    updatedAt: report.analyzedAt
  };
}
