import { getProviderConfig } from "./providers";
import { synthesizeNarrative } from "./scoring";
import type {
  AnalysisReport,
  AnalysisWarning,
  OpenRouterChatCompletionResponse,
  OpenRouterChatMessage,
  ProviderOptions,
  SourceAttribution,
} from "./types";

interface NarrativeEnrichmentResult {
  narrative?: string;
  source: SourceAttribution;
  warning?: AnalysisWarning;
}

function getFetch(fetchImpl?: typeof fetch): typeof fetch {
  if (fetchImpl) {
    return fetchImpl;
  }

  if (typeof fetch !== "function") {
    throw new Error("Fetch API is not available in this runtime.");
  }

  return fetch;
}

function buildNarrativePrompt(report: AnalysisReport): OpenRouterChatMessage[] {
  const summaryPayload = {
    address: report.address,
    token: report.token,
    market: report.market,
    security: report.security,
    distribution: {
      top10HolderPct: report.distribution.top10HolderPct,
      largestHolderPct: report.distribution.largestHolderPct,
      holderCount: report.distribution.holderCount,
      notableWallets: report.distribution.notableWallets.slice(0, 3),
    },
    scores: report.scores,
    recommendation: report.recommendation,
    warnings: report.warnings,
  };

  return [
    {
      role: "system",
      content:
        "You are a cautious Solana token analyst. Write 2-4 sentences. Do not give financial advice, do not use overconfident language, and explicitly mention limited coverage when completeness is below 0.45.",
    },
    {
      role: "user",
      content: `Create a concise narrative for this normalized token analysis report:\n${JSON.stringify(
        summaryPayload,
      )}`,
    },
  ];
}

function sanitizeNarrative(
  narrative: string | undefined,
  fallback: string,
  completeness: number,
): string {
  const trimmed = narrative?.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return fallback;
  }

  const softened = trimmed
    .replace(/\bstrong buy\b/gi, "speculative setup")
    .replace(/\bmust buy\b/gi, "worth monitoring")
    .replace(/\bguaranteed\b/gi, "possible")
    .replace(/\bwill\b/gi, "could");

  if (completeness < 0.45 && !/limited|partial|incomplete|coverage/i.test(softened)) {
    return `Data coverage is limited, so this AI summary should be treated as tentative. ${softened}`;
  }

  return softened;
}

export async function enrichNarrativeWithOpenRouter(
  report: AnalysisReport,
  options: ProviderOptions = {},
): Promise<NarrativeEnrichmentResult> {
  const config = getProviderConfig(options.config);
  if (!config.openRouterApiKey) {
    return {
      source: {
        provider: "openrouter",
        status: "skipped",
        fields: ["narrative"],
        note: "Missing OPENROUTER_API_KEY.",
      },
    };
  }

  const fetchImpl = getFetch(options.fetchImpl);
  const url = `${config.openRouterBaseUrl}/chat/completions`;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openRouterApiKey}`,
      "content-type": "application/json",
      ...(config.openRouterReferer
        ? { "HTTP-Referer": config.openRouterReferer }
        : {}),
      ...(config.openRouterTitle ? { "X-Title": config.openRouterTitle } : {}),
    },
    body: JSON.stringify({
      model: config.openRouterModel ?? "openrouter/free",
      messages: buildNarrativePrompt(report),
      temperature: 0.2,
    }),
  }).catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "OpenRouter request failed";
    return {
      ok: false,
      status: 0,
      json: async () => ({ error: { message } }),
    } as Response;
  });

  if (!response.ok) {
    return {
      narrative: synthesizeNarrative(report),
      source: {
        provider: "openrouter",
        status: "error",
        fields: ["narrative"],
        url,
        note: `OpenRouter request failed with status ${response.status}.`,
      },
      warning: {
        code: "OPENROUTER_FETCH_FAILED",
        message:
          "OpenRouter narrative enrichment failed, so the deterministic narrative was kept.",
        severity: "info",
        provider: "openrouter",
      },
    };
  }

  const payload =
    (await response.json().catch(() => null)) as OpenRouterChatCompletionResponse | null;
  const model =
    payload?.model ?? config.openRouterModel ?? "openrouter/free";
  const content = payload?.choices?.[0]?.message?.content;
  const fallback = synthesizeNarrative(report);
  const narrative = sanitizeNarrative(content, fallback, report.completeness);

  return {
    narrative,
    source: {
      provider: "openrouter",
      status: content ? "success" : "partial",
      fields: ["narrative"],
      url,
      note: `Model: ${model}`,
    },
    warning:
      content === undefined
        ? {
            code: "OPENROUTER_EMPTY_RESPONSE",
            message:
              "OpenRouter returned an empty narrative, so the deterministic narrative was kept.",
            severity: "info",
            provider: "openrouter",
          }
        : undefined,
  };
}
