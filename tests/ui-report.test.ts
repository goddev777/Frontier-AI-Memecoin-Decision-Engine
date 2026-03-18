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
    helius: {
      token_info: {
        decimals: 9,
        supply: 10_000_000,
        circulating_supply: 8_000_000,
        mint_authority: null,
        freeze_authority: null
      },
      content: {
        metadata: {
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
        }
      ]
    },
    sources: [
      { provider: "dexscreener", status: "success", fields: ["pairs"] },
      { provider: "helius", status: "success", fields: ["asset"] },
      { provider: "openrouter", status: "success", fields: ["narrative"], note: "Model: openrouter/free" }
    ],
    warnings: []
  };
}

describe("toUiAnalysisReport", () => {
  it("maps the engine report into the UI contract with AI metadata and no sources section", () => {
    const snapshot = createSnapshot();
    const engineReport = buildAnalysisReport("So11111111111111111111111111111111111111112", snapshot);
    engineReport.narrative = "Deterministic narrative.";

    const uiReport = toUiAnalysisReport(engineReport, snapshot);

    expect(uiReport.mint).toBe(engineReport.address);
    expect(uiReport.score.recommendation).toBe("BUY");
    expect(uiReport.aiEnrichment?.enabled).toBe(true);
    expect(uiReport.aiEnrichment?.model).toBe("openrouter/free");
    expect("sources" in uiReport).toBe(false);
    expect("bundleCount" in uiReport.bundles).toBe(true);
    expect(uiReport.facts.length).toBeGreaterThan(3);
    expect(uiReport.signals.length).toBeGreaterThan(3);
  });

  it("does not invent scenario prices or concentration safety when market data is unavailable", () => {
    const uiReport = toUiAnalysisReport(createInvalidAddressReport("not-a-valid-address"), {
      sources: [],
      warnings: []
    });

    expect(uiReport.scenarios[0]?.marketCapLowUsd).toBeNull();
    expect(uiReport.scenarios[0]?.marketCapHighUsd).toBeNull();
    expect(uiReport.bundles.status).toBe("Bundle data unavailable");
    expect(uiReport.security.mintAuthority).toBe("Unknown");
    expect(uiReport.security.freezeAuthority).toBe("Unknown");
  });

  it("surfaces RPC fallback messaging when holder totals are unavailable", () => {
    const engineReport = buildAnalysisReport("So11111111111111111111111111111111111111112", {
      dexScreener: {
        pairs: createSnapshot().dexScreener?.pairs
      },
      helius: {
        authorities: [
          {
            address: "Auth111111111111111111111111111111111111111",
            scopes: ["metadata"]
          }
        ],
        token_info: {
          decimals: 9,
          supply: 10_000_000,
          circulating_supply: 8_000_000,
          mint_authority: null,
          freeze_authority: null
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
            amount: "1600000000000000",
            uiAmount: 1_600_000,
            uiAmountString: "1600000"
          }
        ]
      },
      sources: [
        { provider: "dexscreener", status: "success", fields: ["pairs"] },
        { provider: "helius", status: "success", fields: ["asset"] },
        { provider: "solana-rpc", status: "success", fields: ["mint"] }
      ],
      warnings: []
    });

    const uiReport = toUiAnalysisReport(engineReport, {
      sources: engineReport.sources,
      warnings: [],
      rpc: {
        largestAccounts: [
          {
            address: "Large111111111111111111111111111111111111111",
            amount: "1600000000000000",
            uiAmount: 1_600_000,
            uiAmountString: "1600000"
          }
        ]
      }
    });

    expect(uiReport.facts.find((fact) => fact.label === "Holders")?.value).toContain("sampled");
    expect(uiReport.holders.commentary).toContain("RPC holder sampling is active");
    expect(uiReport.bundles.commentary).toContain("Helius and RPC concentration samples");
  });
});
