import { getProviderConfig } from "./providers";
import { synthesizeNarrative } from "./scoring";
import type {
  AnalysisReport,
  AnalysisWarning,
  OpenRouterChatCompletionResponse,
  OpenRouterChatMessage,
  ProviderOptions,
  SourceAttribution
} from "./types";

interface NarrativeEnrichmentResult {
  narrative?: string;
  aiSummary?: AnalysisReport["aiSummary"];
  source: SourceAttribution;
  warning?: AnalysisWarning;
}

const OPENROUTER_TIMEOUT_MS = 22_000;

async function parseJsonWithTimeout<T>(response: Response, timeoutMs: number): Promise<T | null> {
  return (await Promise.race([
    response.json() as Promise<T>,
    new Promise<T | null>((_, reject) => {
      setTimeout(() => reject(new Error(`OpenRouter timed out after ${timeoutMs}ms`)), timeoutMs);
    })
  ])) as T | null;
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

function formatMetric(value: number | undefined, prefix = "") {
  if (value === undefined || Number.isNaN(value)) {
    return "unknown";
  }

  const formatted =
    Math.abs(value) >= 1_000_000
      ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value)
      : new Intl.NumberFormat("en-US", { maximumFractionDigits: value >= 1 ? 2 : 4 }).format(value);

  return `${prefix}${formatted}`;
}

function buildNarrativePrompt(report: AnalysisReport): OpenRouterChatMessage[] {
  const compactContext = [
    `Token: ${report.token.name ?? "Unknown"} (${report.token.symbol ?? "UNKNOWN"})`,
    `Price USD: ${formatMetric(report.market.priceUsd, "$")}`,
    `Market cap USD: ${formatMetric(report.market.marketCapUsd ?? report.market.fullyDilutedValuationUsd, "$")}`,
    `Liquidity USD: ${formatMetric(report.market.liquidityUsd, "$")}`,
    `24h volume USD: ${formatMetric(report.market.volume24hUsd, "$")}`,
    `24h buys/sells: ${report.market.buys24h ?? "unknown"} / ${report.market.sells24h ?? "unknown"}`,
    `Coverage: ${Math.round(report.completeness * 100)}%`,
    `Deterministic score: ${report.scores.overall}/100`,
    `Deterministic stance: ${report.recommendation.label}`,
    `Confidence: ${report.scores.confidence}`,
    `Top 10 concentration: ${report.distribution.top10HolderPct ?? "unknown"}%`,
    `Largest holder: ${report.distribution.largestHolderPct ?? "unknown"}%`,
    `Sampled large accounts: ${report.distribution.sampledHolderCount ?? "unknown"}`,
    `Mint authority: ${
      report.security.mintable === undefined ? "unknown" : report.security.mintable ? "active" : "not seen"
    }`,
    `Freeze authority: ${
      report.security.freezable === undefined ? "unknown" : report.security.freezable ? "active" : "not seen"
    }`,
    `Caveats: ${report.recommendation.caveats.slice(0, 3).join("; ") || "none"}`,
    `Notable entities: ${
      report.distribution.notableWallets
        .slice(0, 3)
        .map((wallet) => `${wallet.label} - ${wallet.summary}`)
        .join("; ") || "none"
    }`
  ].join("\n");

  return [
    {
      role: "system",
      content:
        "You are an elite Solana trench analyst. Return strict JSON only with keys setup, whySurfaced, narrative, whatCanBreak. Each value must be 1-2 concise sentences for fast-moving memecoin traders. Be cautious, specific, and mention low coverage when coverage is under 45%."
    },
    {
      role: "user",
      content: `Use this compact report context and produce the JSON object only:\n${compactContext}`
    }
  ];
}

function sanitizeText(value: string | undefined, fallback: string, completeness: number): string {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return fallback;
  }

  const softened = trimmed
    .replace(/\bstrong buy\b/gi, "speculative setup")
    .replace(/\bmust buy\b/gi, "worth monitoring")
    .replace(/\bguaranteed\b/gi, "possible")
    .replace(/\bwill\b/gi, "could");

  if (completeness < 0.45 && !/limited|partial|incomplete|coverage/i.test(softened)) {
    return `Coverage is limited, so treat this as a tentative AI read. ${softened}`;
  }

  return softened;
}

function extractJsonObject(content: string | undefined): Record<string, string> | null {
  const trimmed = content?.trim();
  if (!trimmed) {
    return null;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? trimmed;
  const objectStart = candidate.indexOf("{");
  const objectEnd = candidate.lastIndexOf("}");

  if (objectStart === -1 || objectEnd === -1 || objectEnd <= objectStart) {
    return null;
  }

  try {
    const parsed = JSON.parse(candidate.slice(objectStart, objectEnd + 1));
    return typeof parsed === "object" && parsed ? (parsed as Record<string, string>) : null;
  } catch {
    return null;
  }
}

function deriveSummaryFromText(content: string | undefined, report: AnalysisReport): AnalysisReport["aiSummary"] | undefined {
  const cleaned = sanitizeText(content, synthesizeNarrative(report), report.completeness);
  if (!cleaned) {
    return undefined;
  }

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return {
    setup: sanitizeText(sentences[0], report.recommendation.summary, report.completeness),
    whySurfaced: sanitizeText(
      sentences[1],
      report.recommendation.rationale.slice(0, 2).join(" "),
      report.completeness
    ),
    narrative: cleaned,
    whatCanBreak: sanitizeText(
      sentences.slice(2).join(" "),
      report.recommendation.caveats.join(" ") || "Momentum, liquidity, and concentration can break the setup quickly.",
      report.completeness
    )
  };
}

export async function enrichNarrativeWithOpenRouter(
  report: AnalysisReport,
  options: ProviderOptions = {}
): Promise<NarrativeEnrichmentResult> {
  const config = getProviderConfig(options.config);
  if (!config.openRouterApiKey) {
    return {
      source: {
        provider: "openrouter",
        status: "skipped",
        fields: ["setup", "whySurfaced", "narrative", "whatCanBreak"],
        note: "Missing OPENROUTER_API_KEY."
      }
    };
  }

  const fetchImpl = getFetch(options.fetchImpl);
  const url = `${config.openRouterBaseUrl}/chat/completions`;
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const response = await Promise.race([
    fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openRouterApiKey}`,
        "content-type": "application/json",
        ...(config.openRouterReferer ? { "HTTP-Referer": config.openRouterReferer } : {}),
        ...(config.openRouterTitle ? { "X-Title": config.openRouterTitle } : {})
      },
      body: JSON.stringify({
        model: config.openRouterModel ?? "openrouter/free",
        messages: buildNarrativePrompt(report),
        temperature: 0.2,
        max_tokens: 320
      }),
      signal: controller.signal
    }),
    new Promise<Response>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error(`OpenRouter timed out after ${OPENROUTER_TIMEOUT_MS}ms`));
      }, OPENROUTER_TIMEOUT_MS);
    })
  ])
    .catch((error: unknown) => {
      const message =
        error instanceof Error
          ? error.name === "AbortError" || /timed out/i.test(error.message)
            ? `OpenRouter timed out after ${OPENROUTER_TIMEOUT_MS}ms`
            : error.message
          : "OpenRouter request failed";
      return {
        ok: false,
        status: 0,
        json: async () => ({ error: { message } })
      } as Response;
    })
    .finally(() => {
      clearTimeout(timeoutId);
    });

  if (!response.ok) {
    return {
      narrative: synthesizeNarrative(report),
      source: {
        provider: "openrouter",
        status: "error",
        fields: ["setup", "whySurfaced", "narrative", "whatCanBreak"],
        url,
        note: `OpenRouter request failed with status ${response.status}.`
      },
      warning: {
        code: "OPENROUTER_FETCH_FAILED",
        message: "OpenRouter report synthesis failed, so the deterministic report was kept.",
        severity: "info",
        provider: "openrouter"
      }
    };
  }

  const payload = await parseJsonWithTimeout<OpenRouterChatCompletionResponse>(response, OPENROUTER_TIMEOUT_MS).catch(
    () => null
  );
  const model = payload?.model ?? config.openRouterModel ?? "openrouter/free";
  const content = payload?.choices?.[0]?.message?.content;
  const parsed = extractJsonObject(content);
  const fallbackNarrative = synthesizeNarrative(report);
  const aiSummary =
    parsed
    ? {
        setup: sanitizeText(parsed.setup, report.recommendation.summary, report.completeness),
        whySurfaced: sanitizeText(
          parsed.whySurfaced,
          report.recommendation.rationale.slice(0, 2).join(" "),
          report.completeness
        ),
        narrative: sanitizeText(parsed.narrative, fallbackNarrative, report.completeness),
        whatCanBreak: sanitizeText(
          parsed.whatCanBreak,
          report.recommendation.caveats.join(" ") || "Momentum, liquidity, and concentration can break the setup quickly.",
          report.completeness
        )
      }
    : deriveSummaryFromText(content, report);

  return {
    narrative: aiSummary?.narrative ?? fallbackNarrative,
    aiSummary,
    source: {
      provider: "openrouter",
      status: aiSummary ? "success" : "partial",
      fields: ["setup", "whySurfaced", "narrative", "whatCanBreak"],
      url,
      note: `Model: ${model}`
    },
    warning:
      aiSummary === undefined
        ? {
            code: "OPENROUTER_EMPTY_RESPONSE",
            message: "OpenRouter returned an unusable report payload, so the deterministic report was kept.",
            severity: "info",
            provider: "openrouter"
          }
        : undefined
  };
}
