import type { AnalysisReport } from "@/lib/types";

import { parseAnalysisPayload } from "@/app/_lib/analysis-schema";

const DEFAULT_ANALYSIS_PATH = "/api/analysis";
const SOLANA_MINT_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function normalizeMint(value: string | undefined | null) {
  return value?.trim() ?? "";
}

export function isProbablySolanaMint(value: string | undefined | null) {
  const normalized = normalizeMint(value);
  return SOLANA_MINT_PATTERN.test(normalized);
}

function buildAnalysisUrl(mint: string) {
  const template = process.env.NEXT_PUBLIC_ANALYSIS_API_PATH || DEFAULT_ANALYSIS_PATH;
  const encodedMint = encodeURIComponent(mint);

  if (template.includes(":mint")) {
    return template.replace(":mint", encodedMint);
  }

  if (template.includes("[mint]")) {
    return template.replace("[mint]", encodedMint);
  }

  const separator = template.includes("?") ? "&" : "?";
  return `${template}${separator}mint=${encodedMint}`;
}

export async function fetchAnalysisReport(
  mint: string,
  signal?: AbortSignal
): Promise<AnalysisReport | null> {
  const normalizedMint = normalizeMint(mint);

  if (!normalizedMint) {
    return null;
  }

  const response = await fetch(buildAnalysisUrl(normalizedMint), {
    cache: "no-store",
    headers: {
      Accept: "application/json"
    },
    signal
  });

  if (response.status === 204 || response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Analysis API returned ${response.status} ${response.statusText}`.trim());
  }

  return parseAnalysisPayload(await response.json());
}
