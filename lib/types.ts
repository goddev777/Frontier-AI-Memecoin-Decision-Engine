export type SignalTone = "positive" | "neutral" | "caution" | "negative";
export type RiskSeverity = "low" | "medium" | "high";

export interface AnalysisFact {
  label: string;
  value: string;
  detail?: string;
  tone?: SignalTone;
}

export interface AnalysisRisk {
  title: string;
  detail: string;
  severity: RiskSeverity;
}

export interface AnalysisScenario {
  name: string;
  probability: string;
  marketCapLowUsd?: number | null;
  marketCapHighUsd?: number | null;
  returnLowPct?: number | null;
  returnHighPct?: number | null;
  summary: string;
}

export interface AnalysisAiEnrichment {
  available: boolean;
  enabled: boolean;
  provider?: string;
  model?: string;
  status?: "available" | "disabled" | "unavailable" | "error";
  summary?: string;
  updatedAt?: string;
}

export interface AnalysisReport {
  mint: string;
  token: {
    name: string;
    symbol: string;
    chain?: string;
    launchedAt?: string;
    priceUsd?: number | null;
    marketCapUsd?: number | null;
    liquidityUsd?: number | null;
    volume24hUsd?: number | null;
    holders?: number | null;
  };
  score: {
    value: number;
    max: number;
    percentile?: string;
    recommendation: string;
    confidence: string;
    suggestedSizeTier: string;
    timeHorizon: string;
    riskLevel: RiskSeverity;
  };
  summary: {
    setup: string;
    whySurfaced: string;
    narrative: string;
    whatCanBreak: string;
  };
  facts: AnalysisFact[];
  signals: AnalysisFact[];
  scenarios: AnalysisScenario[];
  risks: AnalysisRisk[];
  holders: {
    concentration: string;
    top10SharePct?: number | null;
    freshWalletSharePct?: number | null;
    commentary: string;
  };
  bundles: {
    status: string;
    bundleCount?: number | null;
    commentary: string;
  };
  security: {
    mintAuthority: string;
    freezeAuthority: string;
    lpStatus: string;
    commentary: string;
  };
  aiEnrichment?: AnalysisAiEnrichment;
  updatedAt: string;
}
