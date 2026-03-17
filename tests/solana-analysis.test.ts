import { describe, expect, it, vi } from "vitest";

import {
  buildAnalysisReport,
  calculateAnalysisScores,
  calculateMarketCapScenarios,
  createInvalidAddressReport,
  enrichNarrativeWithOpenRouter,
  fetchProviderSnapshot,
  generateRecommendation,
} from "../lib/solana-analysis";
import type { AnalysisReport, ProviderSnapshot } from "../lib/solana-analysis";

function createSnapshot(overrides: Partial<ProviderSnapshot> = {}): ProviderSnapshot {
  return {
    dexScreener: {
      pairs: [
        {
          chainId: "solana",
          dexId: "raydium",
          pairAddress: "PAIR11111111111111111111111111111111111111",
          url: "https://dexscreener.com/solana/pair",
          baseToken: {
            address: "So11111111111111111111111111111111111111112",
            symbol: "TEST",
            name: "Test Token",
          },
          quoteToken: {
            symbol: "SOL",
          },
          priceUsd: "0.5",
          marketCap: 5_000_000,
          fdv: 6_200_000,
          liquidity: {
            usd: 750_000,
          },
          volume: {
            h24: 1_400_000,
          },
          priceChange: {
            h24: 12.5,
          },
          txns: {
            h24: {
              buys: 420,
              sells: 390,
            },
          },
        },
      ],
    },
    birdeye: {
      overview: {
        address: "So11111111111111111111111111111111111111112",
        symbol: "TEST",
        name: "Test Token",
        decimals: 9,
        supply: 10_000_000,
        circulatingSupply: 8_000_000,
        price: 0.5,
        liquidity: 700_000,
        mc: 5_000_000,
        fdv: 6_200_000,
      },
      security: {
        top10HolderBalancePercentage: 28,
        mutableMetadata: false,
        mintable: false,
        freezable: false,
      },
      holders: {
        total: 7_200,
        items: [
          {
            owner: "Holder111111111111111111111111111111111111111",
            balance: 800_000,
            percentage: 8,
          },
          {
            owner: "Holder222222222222222222222222222222222222222",
            balance: 500_000,
            percentage: 5,
          },
        ],
      },
      topTraders: {
        items: [
          {
            owner: "Trader111111111111111111111111111111111111111",
            volume: 240_000,
          },
        ],
      },
    },
    helius: {
      token_info: {
        decimals: 9,
        circulating_supply: 8_000_000,
        mint_authority: null,
        freeze_authority: null,
      },
      content: {
        metadata: {
          description: "Synthetic fixture token",
        },
      },
    },
    rpc: {
      supply: {
        amount: "10000000000000000",
        decimals: 9,
        uiAmount: 10_000_000,
        uiAmountString: "10000000",
      },
      mint: {
        decimals: 9,
        mintAuthority: null,
        freezeAuthority: null,
      },
      largestAccounts: [
        {
          address: "Large111111111111111111111111111111111111111",
          amount: "800000000000000",
          uiAmount: 800_000,
          uiAmountString: "800000",
        },
      ],
    },
    bubblemaps: {
      explorerUrl: "https://app.bubblemaps.io/sol/token/So11111111111111111111111111111111111111112",
      embedUrl:
        "https://app.bubblemaps.io/sol/token/So11111111111111111111111111111111111111112?embed=1",
    },
    sources: [
      { provider: "dexscreener", status: "success", fields: ["pairs"] },
      { provider: "birdeye", status: "success", fields: ["overview"] },
      { provider: "helius", status: "success", fields: ["asset"] },
      { provider: "solana-rpc", status: "success", fields: ["mint"] },
      { provider: "bubblemaps", status: "partial", fields: ["embedUrl"] },
    ],
    warnings: [],
    ...overrides,
  };
}

function createReport(): AnalysisReport {
  return buildAnalysisReport(
    "So11111111111111111111111111111111111111112",
    createSnapshot(),
  );
}

describe("solana analysis scoring", () => {
  it("calculates deterministic blended scores from normalized metrics", () => {
    const report = createReport();

    expect(report.scores.overall).toBe(84.9);
    expect(report.scores.liquidity.value).toBe(90);
    expect(report.scores.activity.value).toBe(82.5);
    expect(report.scores.distribution.value).toBe(74);
    expect(report.scores.trust.value).toBe(91.5);
    expect(report.recommendation.label).toBe("constructive");
  });

  it("produces stable market-cap scenarios", () => {
    const scores = calculateAnalysisScores({
      market: {
        priceUsd: 0.5,
        marketCapUsd: 5_000_000,
        fullyDilutedValuationUsd: 6_200_000,
        liquidityUsd: 750_000,
        volume24hUsd: 1_400_000,
        buys24h: 420,
        sells24h: 390,
      },
      security: {
        mintable: false,
        freezable: false,
        mutableMetadata: false,
        mintAuthority: null,
        freezeAuthority: null,
      },
      distribution: {
        totalSupply: 10_000_000,
        circulatingSupply: 8_000_000,
        holderCount: 7_200,
        top10HolderPct: 28,
        largestHolderPct: 8,
        notableWallets: [],
      },
      sources: [
        { status: "success" },
        { status: "success" },
        { status: "success" },
        { status: "success" },
      ],
    });

    const scenarios = calculateMarketCapScenarios({
      market: {
        priceUsd: 0.5,
        marketCapUsd: 5_000_000,
      },
      scores,
    });

    expect(scenarios).toEqual([
      {
        name: "bear",
        multipleVsCurrent: 0.68,
        impliedMarketCapUsd: 3_400_000,
        impliedPriceUsd: 0.34,
        description:
          "Risk-off scenario with softer liquidity support and weaker follow-through.",
      },
      {
        name: "base",
        multipleVsCurrent: 1.61,
        impliedMarketCapUsd: 8_050_000,
        impliedPriceUsd: 0.805,
        description:
          "Continuation case that assumes the current setup broadly persists.",
      },
      {
        name: "bull",
        multipleVsCurrent: 3.24,
        impliedMarketCapUsd: 16_200_000,
        impliedPriceUsd: 1.62,
        description:
          "Upside case that assumes the token sustains traction without a major risk event.",
      },
    ]);
  });

  it("keeps recommendations conservative when coverage is thin", () => {
    const recommendation = generateRecommendation({
      market: {
        liquidityUsd: 85_000,
      },
      security: {},
      distribution: {
        notableWallets: [],
      },
      scores: {
        overall: 63,
        liquidity: {
          value: 58,
          label: "mixed",
          explanation: "Liquidity is present.",
          weight: 0.3,
          available: true,
        },
        activity: {
          value: 50,
          label: "mixed",
          explanation: "Activity is unclear.",
          weight: 0.2,
          available: false,
        },
        distribution: {
          value: 50,
          label: "mixed",
          explanation: "Distribution is unclear.",
          weight: 0.25,
          available: false,
        },
        trust: {
          value: 64,
          label: "mixed",
          explanation: "Trust is only partially known.",
          weight: 0.25,
          available: false,
        },
        completeness: 0.28,
        confidence: "low",
      },
    });

    expect(recommendation.label).toBe("watch");
    expect(recommendation.confidence).toBe("low");
    expect(recommendation.summary.toLowerCase()).toContain("partial");
    expect(recommendation.summary.toLowerCase()).not.toContain("strong buy");
  });

  it("falls back safely when OpenRouter is not configured", async () => {
    const report = createReport();
    const enrichment = await enrichNarrativeWithOpenRouter(report, {
      config: {
        openRouterApiKey: undefined,
      },
    });

    expect(enrichment.source.provider).toBe("openrouter");
    expect(enrichment.source.status).toBe("skipped");
    expect(enrichment.narrative).toBeUndefined();
  });

  it("sanitizes overconfident OpenRouter output under low completeness", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        model: "openrouter/free",
        choices: [
          {
            message: {
              content: "This is a strong buy and will explode from here.",
            },
          },
        ],
      }),
    })) as unknown as typeof fetch;

    const report = createReport();
    report.completeness = 0.2;

    const enrichment = await enrichNarrativeWithOpenRouter(report, {
      fetchImpl,
      config: {
        openRouterApiKey: "test-key",
        openRouterModel: "openrouter/free",
      },
    });

    expect(enrichment.source.status).toBe("success");
    expect(enrichment.narrative?.toLowerCase()).toContain("limited");
    expect(enrichment.narrative?.toLowerCase()).not.toContain("strong buy");
    expect(enrichment.narrative?.toLowerCase()).not.toContain("will explode");
  });

  it("returns a safe invalid-address report without provider assumptions", () => {
    const report = createInvalidAddressReport("not-a-valid-address");

    expect(report.isValid).toBe(false);
    expect(report.recommendation.label).toBe("avoid");
    expect(report.scores.confidence).toBe("low");
    expect(report.narrative.toLowerCase()).toContain("validation failed");
    expect(report.sources).toHaveLength(0);
  });

  it("treats Birdeye success:false envelopes as unavailable coverage", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("dexscreener")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ pairs: [] }),
        } as Response;
      }

      if (
        url.includes("token_overview") ||
        url.includes("token_security") ||
        url.includes("token/holder") ||
        url.includes("top_traders")
      ) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: false, data: null }),
        } as Response;
      }

      if (url.includes("bubblemaps")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ clusters: [] }),
        } as Response;
      }

      return {
        ok: false,
        status: 500,
        json: async () => ({}),
      } as Response;
    }) as unknown as typeof fetch;

    const snapshot = await fetchProviderSnapshot(
      "So11111111111111111111111111111111111111112",
      {
        fetchImpl,
        config: {
          birdeyeApiKey: "test-key",
        },
      },
    );

    const birdeyeSource = snapshot.sources.find((source) => source.provider === "birdeye");
    expect(birdeyeSource?.status).toBe("error");
    expect(snapshot.birdeye?.overview).toBeUndefined();
    expect(snapshot.warnings.some((warning) => warning.code === "BIRDEYE_PARTIAL_DATA")).toBe(true);
  });
});
