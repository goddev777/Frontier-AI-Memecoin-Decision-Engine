import { z } from "zod";

import type { AnalysisReport } from "@/lib/types";

const analysisFactSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  detail: z.string().optional(),
  tone: z.enum(["positive", "neutral", "caution", "negative"]).optional()
});

const analysisRiskSchema = z.object({
  title: z.string().min(1),
  detail: z.string().min(1),
  severity: z.enum(["low", "medium", "high"])
});

const analysisScenarioSchema = z.object({
  name: z.string().min(1),
  probability: z.string().min(1),
  marketCapLowUsd: z.number().nullable().optional(),
  marketCapHighUsd: z.number().nullable().optional(),
  returnLowPct: z.number().nullable().optional(),
  returnHighPct: z.number().nullable().optional(),
  summary: z.string().min(1)
});

export const analysisReportSchema: z.ZodType<AnalysisReport> = z.object({
  mint: z.string().min(1),
  token: z.object({
    name: z.string().min(1),
    symbol: z.string().min(1),
    chain: z.string().optional(),
    launchedAt: z.string().optional(),
    priceUsd: z.number().nullable().optional(),
    marketCapUsd: z.number().nullable().optional(),
    liquidityUsd: z.number().nullable().optional(),
    volume24hUsd: z.number().nullable().optional(),
    holders: z.number().nullable().optional()
  }),
  score: z.object({
    value: z.number(),
    max: z.number().positive(),
    percentile: z.string().optional(),
    recommendation: z.string().min(1),
    confidence: z.string().min(1),
    suggestedSizeTier: z.string().min(1),
    timeHorizon: z.string().min(1),
    riskLevel: z.enum(["low", "medium", "high"])
  }),
  summary: z.object({
    setup: z.string().min(1),
    whySurfaced: z.string().min(1),
    narrative: z.string().min(1),
    whatCanBreak: z.string().min(1)
  }),
  facts: z.array(analysisFactSchema),
  signals: z.array(analysisFactSchema),
  scenarios: z.array(analysisScenarioSchema),
  risks: z.array(analysisRiskSchema),
  holders: z.object({
    concentration: z.string().min(1),
    top10SharePct: z.number().nullable().optional(),
    freshWalletSharePct: z.number().nullable().optional(),
    commentary: z.string().min(1)
  }),
  bundles: z.object({
    status: z.string().min(1),
    bundleCount: z.number().nullable().optional(),
    commentary: z.string().min(1)
  }),
  security: z.object({
    mintAuthority: z.string().min(1),
    freezeAuthority: z.string().min(1),
    lpStatus: z.string().min(1),
    commentary: z.string().min(1)
  }),
  aiEnrichment: z
    .object({
      available: z.boolean(),
      enabled: z.boolean(),
      provider: z.string().optional(),
      model: z.string().optional(),
      status: z.enum(["available", "disabled", "unavailable", "error"]).optional(),
      summary: z.string().optional(),
      updatedAt: z.string().optional()
    })
    .optional(),
  updatedAt: z.string().min(1)
});

const apiResponseSchema = z.union([
  analysisReportSchema,
  z.object({
    report: analysisReportSchema
  })
]);

export function parseAnalysisPayload(payload: unknown): AnalysisReport {
  const parsed = apiResponseSchema.parse(payload);

  return "report" in parsed ? parsed.report : parsed;
}
