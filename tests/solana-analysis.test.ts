import { describe, expect, it, vi } from "vitest";

import {
  buildAnalysisReport,
  calculateAnalysisScores,
  calculateMarketCapScenarios,
  createInvalidAddressReport,
  enrichNarrativeWithOpenRouter,
  fetchProviderSnapshot,
  generateRecommendation
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
            name: "Test Token"
          },
          quoteToken: {
            symbol: "SOL"
          },
          priceUsd: "0.5",
          marketCap: 5_000_000,
          fdv: 6_200_000,
          liquidity: {
            usd: 750_000
          },
          volume: {
            h24: 1_400_000
          },
          priceChange: {
            h24: 12.5
          },
          txns: {
            h24: {
              buys: 420,
              sells: 390
            }
          }
        }
      ]
    },
    helius: {
      token_info: {
        decimals: 9,
        circulating_supply: 8_000_000,
        mint_authority: null,
        freeze_authority: null
      },
      content: {
        metadata: {
          description: "Synthetic fixture token",
          symbol: "TEST",
          name: "Test Token"
        }
      }
    },
    rpc: {
      supply: {
        amount: "10000000000000000",
        decimals: 9,
        uiAmount: 10_000_000,
        uiAmountString: "10000000"
      },
      mint: {
        decimals: 9,
        mintAuthority: null,
        freezeAuthority: null
      },
      largestAccounts: [
        {
          address: "Large111111111111111111111111111111111111111",
          amount: "800000000000000",
          uiAmount: 800_000,
          uiAmountString: "800000"
        },
        {
          address: "Large222222222222222222222222222222222222222",
          amount: "600000000000000",
          uiAmount: 600_000,
          uiAmountString: "600000"
        },
        {
          address: "Large333333333333333333333333333333333333333",
          amount: "500000000000000",
          uiAmount: 500_000,
          uiAmountString: "500000"
        },
        {
          address: "Large444444444444444444444444444444444444444",
          amount: "500000000000000",
          uiAmount: 500_000,
          uiAmountString: "500000"
        },
        {
          address: "Large555555555555555555555555555555555555555",
          amount: "400000000000000",
          uiAmount: 400_000,
          uiAmountString: "400000"
        }
      ]
    },
    sources: [
      { provider: "dexscreener", status: "success", fields: ["pairs"] },
      { provider: "helius", status: "success", fields: ["asset"] },
      { provider: "solana-rpc", status: "success", fields: ["mint"] }
    ],
    warnings: [],
    ...overrides
  };
}

function createReport(): AnalysisReport {
  return buildAnalysisReport("So11111111111111111111111111111111111111112", createSnapshot());
}

describe("solana analysis scoring", () => {
  it("calculates deterministic blended scores from normalized metrics", () => {
    const report = createReport();

    expect(report.scores.overall).toBeGreaterThan(70);
    expect(report.scores.liquidity.value).toBeGreaterThan(80);
    expect(report.scores.activity.value).toBeGreaterThan(75);
    expect(report.scores.distribution.value).toBeGreaterThan(55);
    expect(report.scores.trust.value).toBeGreaterThan(80);
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
        sells24h: 390
      },
      security: {
        mintable: false,
        freezable: false,
        mintAuthority: null,
        freezeAuthority: null
      },
      distribution: {
        totalSupply: 10_000_000,
        circulatingSupply: 8_000_000,
        sampledHolderCount: 5,
        top10HolderPct: 28,
        largestHolderPct: 8,
        notableWallets: []
      },
      sources: [{ status: "success" }, { status: "success" }, { status: "success" }]
    });

    const scenarios = calculateMarketCapScenarios({
      market: {
        priceUsd: 0.5,
        marketCapUsd: 5_000_000
      },
      scores
    });

    expect(scenarios).toHaveLength(3);
    expect(scenarios[0]?.name).toBe("bear");
    expect(scenarios[1]?.impliedMarketCapUsd).toBeGreaterThan(5_000_000);
    expect(scenarios[2]?.impliedMarketCapUsd).toBeGreaterThan(scenarios[1]?.impliedMarketCapUsd ?? 0);
  });

  it("keeps recommendations conservative when coverage is thin", () => {
    const recommendation = generateRecommendation({
      market: {
        liquidityUsd: 85_000
      },
      security: {},
      distribution: {
        notableWallets: []
      },
      scores: {
        overall: 63,
        liquidity: {
          value: 58,
          label: "mixed",
          explanation: "Liquidity is present.",
          weight: 0.3,
          available: true
        },
        activity: {
          value: 50,
          label: "mixed",
          explanation: "Activity is unclear.",
          weight: 0.2,
          available: false
        },
        distribution: {
          value: 50,
          label: "mixed",
          explanation: "Distribution is unclear.",
          weight: 0.25,
          available: false
        },
        trust: {
          value: 64,
          label: "mixed",
          explanation: "Trust is only partially known.",
          weight: 0.25,
          available: false
        },
        completeness: 0.28,
        confidence: "low"
      }
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
        openRouterApiKey: undefined
      }
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
              content:
                '{"setup":"This is a strong buy and will explode from here.","whySurfaced":"Momentum is strong.","narrative":"This is a strong buy and will explode from here.","whatCanBreak":"Liquidity can disappear quickly."}'
            }
          }
        ]
      })
    })) as unknown as typeof fetch;

    const report = createReport();
    report.completeness = 0.2;

    const enrichment = await enrichNarrativeWithOpenRouter(report, {
      fetchImpl,
      config: {
        openRouterApiKey: "test-key",
        openRouterModel: "openrouter/free"
      }
    });

    expect(enrichment.source.status).toBe("success");
    expect(enrichment.aiSummary?.setup?.toLowerCase()).toContain("limited");
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

  it("fetches provider snapshot without Birdeye or Bubblemaps", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("dexscreener")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ pairs: [] })
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: "2.0",
          result: {}
        })
      } as Response;
    }) as unknown as typeof fetch;

    const snapshot = await fetchProviderSnapshot("So11111111111111111111111111111111111111112", {
      fetchImpl,
      config: {
        heliusApiKey: "test-key"
      }
    });

    expect(snapshot.sources.map((source) => source.provider)).toEqual(["dexscreener", "helius", "solana-rpc"]);
    expect(snapshot.warnings.some((warning) => warning.provider === "dexscreener")).toBe(false);
  });

  it("derives fallback authority and holder-sample context", () => {
    const report = buildAnalysisReport(
      "So11111111111111111111111111111111111111112",
      createSnapshot({
        helius: {
          authorities: [
            {
              address: "Auth111111111111111111111111111111111111111",
              scopes: ["metadata", "freeze"]
            }
          ],
          ownership: {
            owner: "Owner11111111111111111111111111111111111111"
          },
          token_info: {
            decimals: 9,
            circulating_supply: 8_000_000,
            mint_authority: "MintAuth1111111111111111111111111111111111",
            freeze_authority: null
          },
          content: {
            metadata: {
              description: "Synthetic fixture token"
            }
          }
        }
      })
    );

    expect(report.security.creatorAddress).toBe("Auth111111111111111111111111111111111111111");
    expect(report.distribution.sampledHolderCount).toBe(5);
    expect(report.distribution.notableWallets.some((wallet) => wallet.activity === "authority")).toBe(true);
    expect(report.narrative).toContain("RPC surfaced 5 large token accounts");
  });
});
