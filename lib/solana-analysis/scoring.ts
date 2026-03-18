import type {
  AnalysisMetricScore,
  AnalysisReport,
  AnalysisScores,
  ConfidenceLevel,
  MarketCapScenario,
  NotableWallet,
  Recommendation,
  RecommendationLabel,
  TokenDistributionData,
  TokenMarketData,
  TokenSecurityData,
} from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function scoreLabel(value: number): AnalysisMetricScore["label"] {
  if (value >= 70) {
    return "strong";
  }

  if (value >= 45) {
    return "mixed";
  }

  return "weak";
}

function createMetricScore(
  value: number,
  explanation: string,
  weight: number,
  available = true,
): AnalysisMetricScore {
  const bounded = clamp(round(value, 1), 0, 100);
  return {
    value: bounded,
    label: scoreLabel(bounded),
    explanation,
    weight,
    available,
  };
}

function missingMetric(weight: number, explanation: string): AnalysisMetricScore {
  return createMetricScore(50, explanation, weight, false);
}

export function calculateCompleteness(report: {
  market: TokenMarketData;
  security: TokenSecurityData;
  distribution: TokenDistributionData;
  sources?: Array<{ status: string }>;
}): number {
  const checkpoints = [
    report.market.priceUsd,
    report.market.marketCapUsd,
    report.market.liquidityUsd,
    report.market.volume24hUsd,
    report.security.mintable,
    report.security.freezable,
    report.security.mutableMetadata,
    report.distribution.totalSupply,
    report.distribution.top10HolderPct,
    report.distribution.largestHolderPct,
    report.distribution.holderCount,
  ];
  const dataScore =
    checkpoints.filter((value) => value !== undefined && value !== null).length /
    checkpoints.length;
  const sourceScore = report.sources?.length
    ? report.sources.filter((source) => source.status === "success").length /
      report.sources.length
    : 0;

  return round(clamp(dataScore * 0.8 + sourceScore * 0.2, 0, 1), 3);
}

export function calculateLiquidityScore(market: TokenMarketData): AnalysisMetricScore {
  const liquidity = market.liquidityUsd;
  const volume = market.volume24hUsd;

  if (liquidity === undefined && volume === undefined) {
    return missingMetric(0.3, "Liquidity score is based on partial market data.");
  }

  const liquidityBand =
    liquidity === undefined
      ? 45
      : liquidity >= 1_500_000
        ? 90
        : liquidity >= 500_000
          ? 78
          : liquidity >= 100_000
            ? 64
            : liquidity >= 25_000
              ? 48
              : 30;
  const volumeSupport =
    volume === undefined || liquidity === undefined || liquidity === 0
      ? 0
      : clamp((volume / liquidity) * 18, -8, 12);

  return createMetricScore(
    liquidityBand + volumeSupport,
    liquidity !== undefined
      ? `Primary pair liquidity is about $${Math.round(liquidity).toLocaleString()}.`
      : "Volume is available, but pool depth is missing.",
    0.3,
  );
}

export function calculateActivityScore(market: TokenMarketData): AnalysisMetricScore {
  const volume = market.volume24hUsd;
  const buys = market.buys24h;
  const sells = market.sells24h;
  const totalTrades = (buys ?? 0) + (sells ?? 0);

  if (volume === undefined && totalTrades === 0) {
    return missingMetric(0.2, "Activity score is based on limited trade telemetry.");
  }

  const volumeBand =
    volume === undefined
      ? 50
      : volume >= 5_000_000
        ? 92
        : volume >= 1_000_000
          ? 80
          : volume >= 250_000
            ? 68
            : volume >= 50_000
              ? 56
              : 38;
  const flowBalance =
    totalTrades > 0 ? clamp(10 - Math.abs((buys ?? 0) - (sells ?? 0)) * 0.25, -8, 10) : 0;

  return createMetricScore(
    volumeBand + flowBalance,
    volume !== undefined
      ? `24h traded volume is about $${Math.round(volume).toLocaleString()}.`
      : "Trade count is visible, but not quoted volume.",
    0.2,
  );
}

export function calculateDistributionScore(
  distribution: TokenDistributionData,
): AnalysisMetricScore {
  const concentration = distribution.top10HolderPct;
  const whaleShare = distribution.largestHolderPct;

  if (concentration === undefined && whaleShare === undefined) {
    return missingMetric(
      0.25,
      "Holder distribution score is based on incomplete holder coverage.",
    );
  }

  const concentrationPenalty =
    concentration === undefined
      ? 18
      : concentration >= 70
        ? 45
        : concentration >= 45
          ? 28
          : concentration >= 25
            ? 14
            : 6;
  const whalePenalty =
    whaleShare === undefined
      ? 10
      : whaleShare >= 25
        ? 20
        : whaleShare >= 15
          ? 12
          : whaleShare >= 8
            ? 6
            : 2;
  const holderBonus =
    distribution.holderCount === undefined
      ? 0
      : distribution.holderCount >= 25_000
        ? 12
        : distribution.holderCount >= 5_000
          ? 8
          : distribution.holderCount >= 1_000
            ? 4
            : 0;

  return createMetricScore(
    86 - concentrationPenalty - whalePenalty + holderBonus,
    concentration !== undefined
      ? `Top holders control about ${round(concentration, 1)}% of supply.`
      : "Largest wallets are partially known, but full concentration is missing.",
    0.25,
  );
}

export function calculateTrustScore(
  security: TokenSecurityData,
  completeness: number,
): AnalysisMetricScore {
  const signals = [
    security.mintable,
    security.freezable,
    security.mutableMetadata,
    security.transferFeeEnabled,
  ];
  const availableSignals = signals.filter((signal) => signal !== undefined).length;

  if (!availableSignals) {
    return missingMetric(0.25, "Trust score is constrained by missing contract controls.");
  }

  let value = 82;
  if (security.mintable) {
    value -= 22;
  }
  if (security.freezable) {
    value -= 15;
  }
  if (security.mutableMetadata) {
    value -= 10;
  }
  if (security.transferFeeEnabled) {
    value -= 8;
  }
  if (!security.mintAuthority) {
    value += 6;
  }
  if (!security.freezeAuthority) {
    value += 4;
  }

  value -= (1 - completeness) * 12;

  return createMetricScore(
    value,
    security.mintable || security.freezable
      ? "Contract controls remain active, which raises governance risk."
      : "No obvious mint or freeze authority risk is visible in the current dataset.",
    0.25,
  );
}

export function calculateAnalysisScores(report: {
  market: TokenMarketData;
  security: TokenSecurityData;
  distribution: TokenDistributionData;
  sources?: Array<{ status: string }>;
}): AnalysisScores {
  const completeness = calculateCompleteness(report);
  const liquidity = calculateLiquidityScore(report.market);
  const activity = calculateActivityScore(report.market);
  const distribution = calculateDistributionScore(report.distribution);
  const trust = calculateTrustScore(report.security, completeness);
  const metrics = [liquidity, activity, distribution, trust];
  const weightedScore =
    metrics.reduce((sum, metric) => sum + metric.value * metric.weight, 0) /
    metrics.reduce((sum, metric) => sum + metric.weight, 0);
  const confidence: ConfidenceLevel =
    completeness >= 0.75 ? "high" : completeness >= 0.45 ? "medium" : "low";

  return {
    overall: round(weightedScore, 1),
    liquidity,
    activity,
    distribution,
    trust,
    completeness,
    confidence,
  };
}

function formatRiskLine(value: number | undefined, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return `${label} sits near ${round(value, 1)}%.`;
}

function chooseRecommendationLabel(
  overall: number,
  trust: number,
  completeness: number,
): RecommendationLabel {
  if (completeness < 0.3) {
    return overall >= 60 ? "watch" : "avoid";
  }
  if (overall >= 75 && trust >= 70) {
    return "constructive";
  }
  if (overall >= 60) {
    return "speculative";
  }
  if (overall >= 45) {
    return "watch";
  }
  return "avoid";
}

export function generateRecommendation(report: {
  market: TokenMarketData;
  security: TokenSecurityData;
  distribution: TokenDistributionData;
  scores: AnalysisScores;
}): Recommendation {
  const label = chooseRecommendationLabel(
    report.scores.overall,
    report.scores.trust.value,
    report.scores.completeness,
  );
  const lowCoverage = report.scores.completeness < 0.45;
  const rationale = [
    report.scores.liquidity.explanation,
    report.scores.activity.explanation,
    report.scores.distribution.explanation,
    report.scores.trust.explanation,
  ];
  const caveats = [
    lowCoverage
      ? "Coverage is limited, so the call should be treated as an early screen rather than a conviction signal."
      : undefined,
    report.security.mintable ? "Mint authority appears active." : undefined,
    report.security.freezable ? "Freeze authority appears active." : undefined,
    formatRiskLine(report.distribution.top10HolderPct, "Top-10 holder concentration"),
  ].filter((value): value is string => Boolean(value));

  const summaryByLabel: Record<RecommendationLabel, string> = {
    constructive: lowCoverage
      ? "The token screens reasonably well, but the missing coverage keeps this in tentative territory."
      : "The token shows a comparatively constructive setup across liquidity, activity, and control risk.",
    speculative: lowCoverage
      ? "There are some promising signals, but the incomplete dataset keeps this as a speculative watchlist idea."
      : "The token has enough positive momentum to stay interesting, but risk controls and distribution still matter.",
    watch: lowCoverage
      ? "The current read is too partial for a decisive call, so this fits better as a watchlist candidate."
      : "The setup is mixed and worth monitoring rather than chasing.",
    avoid: lowCoverage
      ? "With thin coverage and weak current signals, the safer stance is to stay cautious."
      : "The present balance of liquidity, distribution, and contract risk argues for caution.",
  };

  return {
    label,
    confidence: report.scores.confidence,
    summary: summaryByLabel[label],
    rationale,
    caveats,
  };
}

export function calculateMarketCapScenarios(report: {
  market: TokenMarketData;
  scores: AnalysisScores;
}): MarketCapScenario[] {
  const currentMarketCap =
    report.market.marketCapUsd ?? report.market.fullyDilutedValuationUsd;
  const currentPrice = report.market.priceUsd;

  if (!currentMarketCap) {
    return [
      {
        name: "bear",
        description: "Not enough market-cap context is available to model downside.",
      },
      {
        name: "base",
        description: "Not enough market-cap context is available to model a base case.",
      },
      {
        name: "bull",
        description: "Not enough market-cap context is available to model upside.",
      },
    ];
  }

  const quality = report.scores.overall / 100;
  const completeness = report.scores.completeness;
  const bearMultiple = round(clamp(0.3 + quality * 0.45, 0.25, 0.85), 2);
  const baseMultiple = round(
    clamp(0.8 + quality * 0.75 + (completeness - 0.5) * 0.35, 0.55, 1.9),
    2,
  );
  const bullMultiple = round(
    clamp(1.2 + quality * 1.7 + completeness * 0.6, 1.15, 4),
    2,
  );
  const scenarios = [
    {
      name: "bear" as const,
      multipleVsCurrent: bearMultiple,
      description: "Risk-off scenario with softer liquidity support and weaker follow-through.",
    },
    {
      name: "base" as const,
      multipleVsCurrent: baseMultiple,
      description: "Continuation case that assumes the current setup broadly persists.",
    },
    {
      name: "bull" as const,
      multipleVsCurrent: bullMultiple,
      description: "Upside case that assumes the token sustains traction without a major risk event.",
    },
  ];

  return scenarios.map((scenario) => ({
    ...scenario,
    impliedMarketCapUsd: round(currentMarketCap * (scenario.multipleVsCurrent ?? 1), 2),
    impliedPriceUsd:
      currentPrice !== undefined && scenario.multipleVsCurrent !== undefined
        ? round(currentPrice * scenario.multipleVsCurrent, 8)
        : undefined,
  }));
}

export function summarizeNotableWallets(wallets: NotableWallet[]): string {
  if (!wallets.length) {
    return "No notable wallet concentration data was available.";
  }

  return wallets
    .slice(0, 3)
    .map((wallet) => `${wallet.label}: ${wallet.summary}`)
    .join(" ");
}

export function synthesizeNarrative(report: AnalysisReport): string {
  const pair = report.market.selectedPair;
  const pairSummary = pair
    ? `DexScreener points to ${pair.dexId ?? "a live Solana pair"} with roughly $${Math.round(
        pair.liquidityUsd ?? 0,
      ).toLocaleString()} in liquidity.`
    : "A dominant Solana trading pair was not confirmed.";
  const riskSummary = [
    report.security.mintable ? "mint authority appears active" : undefined,
    report.security.freezable ? "freeze authority appears active" : undefined,
    report.distribution.top10HolderPct !== undefined
      ? `top-10 wallets hold about ${round(report.distribution.top10HolderPct, 1)}% of supply`
      : undefined,
    report.distribution.holderCount === undefined && report.distribution.sampledHolderCount !== undefined
      ? `RPC surfaced ${report.distribution.sampledHolderCount} large token accounts, but full holder count is still unknown`
      : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .join(", ");
  const confidenceLine =
    report.scores.confidence === "low"
      ? "Coverage is still limited, so this should be treated as a cautious first-pass screen."
      : report.scores.confidence === "medium"
        ? "The dataset is good enough for a directional view, but there are still blind spots."
        : "Coverage is broad enough to support a firmer comparative read.";

  return `${pairSummary} The blended score is ${round(
    report.scores.overall,
    1,
  )}/100 and currently maps to a ${report.recommendation.label} stance. ${
    riskSummary ? `Key risk notes: ${riskSummary}.` : ""
  } ${summarizeNotableWallets(report.distribution.notableWallets)} ${confidenceLine}`.trim();
}
