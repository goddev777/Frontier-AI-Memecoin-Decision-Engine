import { describe, expect, it } from "vitest";

import { buildAnalysisReport, createInvalidAddressReport } from "@/lib/solana-analysis";
import { toUiAnalysisReport } from "@/lib/solana-analysis/ui-report";
import type { ProviderSnapshot } from "@/lib/solana-analysis";

function createSnapshot(): ProviderSnapshot {
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
        fdv: 6_200_000
      },
      security: {
        top10HolderBalancePercentage: 28,
        mutableMetadata: false,
        mintable: false,
        freezable: false
      },
      holders: {
        total: 7_200,
        items: [
          {
            owner: "Holder111111111111111111111111111111111111111",
            balance: 800_000,
            percentage: 8
          }
        ]
      }
    },
    bubblemaps: {
      explorerUrl: "https://app.bubblemaps.io/sol/token/So11111111111111111111111111111111111111112",
      embedUrl:
        "https://iframe.bubblemaps.io/map?address=So11111111111111111111111111111111111111112&chain=solana&partnerId=test",
      apiData: {
        clusters: [{ id: "cluster-1", share: 0.12 }]
      }
    },
    sources: [
      { provider: "dexscreener", status: "success", fields: ["pairs"] },
      { provider: "birdeye", status: "success", fields: ["overview"] },
      { provider: "openrouter", status: "success", fields: ["narrative"], note: "Model: openrouter/free" }
    ],
    warnings: []
  };
}

describe("toUiAnalysisReport", () => {
  it("maps the engine report into the UI contract with AI and bubble map metadata", () => {
    const snapshot = createSnapshot();
    const engineReport = buildAnalysisReport(
      "So11111111111111111111111111111111111111112",
      snapshot
    );
    engineReport.narrative = "Deterministic narrative.";

    const uiReport = toUiAnalysisReport(engineReport, snapshot);

    expect(uiReport.mint).toBe(engineReport.address);
    expect(uiReport.score.recommendation).toBe("BUY");
    expect(uiReport.aiEnrichment?.enabled).toBe(true);
    expect(uiReport.aiEnrichment?.model).toBe("openrouter/free");
    expect(uiReport.bubbleMap?.url).toContain("iframe.bubblemaps.io");
    expect(uiReport.sources[0]?.label).toBe("DexScreener");
    expect(uiReport.facts.length).toBeGreaterThan(3);
    expect(uiReport.signals.length).toBeGreaterThan(3);
  });

  it("does not invent scenario prices or bundle safety when market data is unavailable", () => {
    const uiReport = toUiAnalysisReport(
      createInvalidAddressReport("not-a-valid-address"),
      {
        sources: [],
        warnings: []
      }
    );

    expect(uiReport.scenarios[0]?.marketCapLowUsd).toBeNull();
    expect(uiReport.scenarios[0]?.marketCapHighUsd).toBeNull();
    expect(uiReport.bundles.status).toBe("Bundle data unavailable");
    expect(uiReport.security.mintAuthority).toBe("Unknown");
    expect(uiReport.security.freezeAuthority).toBe("Unknown");
  });
});
