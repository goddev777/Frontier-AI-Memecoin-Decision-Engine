import { enrichNarrativeWithOpenRouter } from "./openrouter";
import {
  fetchProviderSnapshot,
  selectBestDexPair,
  toNumber,
  validateSolanaAddress,
} from "./providers";
import {
  calculateAnalysisScores,
  calculateMarketCapScenarios,
  generateRecommendation,
  synthesizeNarrative,
} from "./scoring";
import type {
  AnalysisReport,
  NotableWallet,
  ProviderOptions,
  ProviderSnapshot,
  SelectedPairSummary,
  TokenDistributionData,
  TokenIdentity,
  TokenMarketData,
  TokenSecurityData,
} from "./types";

function shortenAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function dedupeWallets(wallets: NotableWallet[]): NotableWallet[] {
  const seen = new Set<string>();
  return wallets.filter((wallet) => {
    if (seen.has(wallet.address)) {
      return false;
    }

    seen.add(wallet.address);
    return true;
  });
}

function deriveSelectedPair(
  address: string,
  snapshot: ProviderSnapshot,
): SelectedPairSummary | undefined {
  const pair = selectBestDexPair(snapshot.dexScreener?.pairs, address);
  if (!pair) {
    return undefined;
  }

  return {
    pairAddress: pair.pairAddress,
    url: pair.url,
    dexId: pair.dexId,
    quoteSymbol: pair.quoteToken?.symbol,
    liquidityUsd: pair.liquidity?.usd,
    volume24hUsd: pair.volume?.h24,
  };
}

function deriveIdentity(address: string, snapshot: ProviderSnapshot): TokenIdentity {
  const pair = selectBestDexPair(snapshot.dexScreener?.pairs, address);
  const overview = snapshot.birdeye?.overview;
  const asset = snapshot.helius;

  return {
    address,
    symbol:
      overview?.symbol ??
      pair?.baseToken?.symbol ??
      asset?.content?.metadata?.symbol ??
      shortenAddress(address),
    name:
      overview?.name ??
      pair?.baseToken?.name ??
      asset?.content?.metadata?.name ??
      "Unknown token",
    decimals:
      overview?.decimals ??
      snapshot.rpc?.mint?.decimals ??
      snapshot.helius?.token_info?.decimals,
    logoUrl: overview?.logoURI ?? asset?.content?.links?.image,
    description: asset?.content?.metadata?.description,
  };
}

function deriveMarket(address: string, snapshot: ProviderSnapshot): TokenMarketData {
  const pair = selectBestDexPair(snapshot.dexScreener?.pairs, address);
  const overview = snapshot.birdeye?.overview;

  return {
    priceUsd:
      toNumber(pair?.priceUsd) ??
      overview?.price ??
      snapshot.helius?.token_info?.price_info?.price_per_token,
    marketCapUsd: pair?.marketCap ?? overview?.mc,
    fullyDilutedValuationUsd: pair?.fdv ?? overview?.fdv,
    liquidityUsd: pair?.liquidity?.usd ?? overview?.liquidity,
    volume24hUsd: pair?.volume?.h24,
    priceChange24hPct: pair?.priceChange?.h24 ?? overview?.price24hChangePercent,
    buys24h: pair?.txns?.h24?.buys,
    sells24h: pair?.txns?.h24?.sells,
    selectedPair: deriveSelectedPair(address, snapshot),
  };
}

function deriveSecurity(snapshot: ProviderSnapshot): TokenSecurityData {
  const security = snapshot.birdeye?.security;
  const helius = snapshot.helius?.token_info;
  const rpcMint = snapshot.rpc?.mint;
  const mintAuthority = helius?.mint_authority ?? rpcMint?.mintAuthority;
  const freezeAuthority = helius?.freeze_authority ?? rpcMint?.freezeAuthority;
  const mintable =
    security?.mintable !== undefined
      ? security.mintable
      : mintAuthority !== undefined
        ? Boolean(mintAuthority)
        : undefined;
  const freezable =
    security?.freezable !== undefined
      ? security.freezable
      : freezeAuthority !== undefined
        ? Boolean(freezeAuthority)
        : undefined;

  return {
    mutableMetadata: security?.mutableMetadata,
    mintable,
    freezable,
    transferFeeEnabled: security?.transferFeeEnable,
    mintAuthority: mintAuthority ?? null,
    freezeAuthority: freezeAuthority ?? null,
    creatorAddress: security?.creatorAddress,
    verified:
      security?.mutableMetadata === false &&
      mintable === false &&
      freezable === false,
  };
}

function deriveLargestHolderPct(
  snapshot: ProviderSnapshot,
  totalSupply?: number,
): number | undefined {
  const holder = snapshot.birdeye?.holders?.items?.[0];
  if (holder?.percentage !== undefined) {
    return holder.percentage;
  }

  const largestAccount = snapshot.rpc?.largestAccounts?.[0];
  if (!largestAccount || !totalSupply) {
    return undefined;
  }

  const balance =
    largestAccount.uiAmount ??
    toNumber(largestAccount.uiAmountString) ??
    toNumber(largestAccount.amount);
  if (balance === undefined || totalSupply === 0) {
    return undefined;
  }

  return round((balance / totalSupply) * 100, 3);
}

function deriveTop10HolderPct(
  snapshot: ProviderSnapshot,
  totalSupply?: number,
): number | undefined {
  const securityPct =
    snapshot.birdeye?.security?.top10HolderBalancePercentage ??
    snapshot.birdeye?.security?.top10UserBalancePercentage;
  if (securityPct !== undefined) {
    return securityPct;
  }

  const holders = snapshot.birdeye?.holders?.items;
  if (holders?.length) {
    const listedPct = holders
      .slice(0, 10)
      .reduce((sum, holder) => sum + (holder.percentage ?? 0), 0);
    return round(listedPct, 3);
  }

  if (!snapshot.rpc?.largestAccounts?.length || !totalSupply) {
    return undefined;
  }

  const topBalance = snapshot.rpc.largestAccounts.slice(0, 10).reduce((sum, account) => {
    const balance =
      account.uiAmount ??
      toNumber(account.uiAmountString) ??
      toNumber(account.amount) ??
      0;
    return sum + balance;
  }, 0);

  return totalSupply === 0 ? undefined : round((topBalance / totalSupply) * 100, 3);
}

function summarizeHolders(snapshot: ProviderSnapshot, totalSupply?: number): NotableWallet[] {
  const wallets: NotableWallet[] = [];

  for (const holder of snapshot.birdeye?.holders?.items ?? []) {
    const address = holder.owner ?? holder.address;
    if (!address) {
      continue;
    }

    const sharePct =
      holder.percentage ??
      (holder.balance !== undefined && totalSupply
        ? round((holder.balance / totalSupply) * 100, 3)
        : undefined);

    wallets.push({
      address,
      label: `Top holder ${wallets.length + 1}`,
      balance: holder.balance ?? holder.uiAmount,
      sharePct,
      activity: "holder",
      summary:
        sharePct !== undefined
          ? `controls about ${round(sharePct, 2)}% of visible supply`
          : "is among the largest visible holders",
    });
  }

  if (!wallets.length) {
    for (const account of snapshot.rpc?.largestAccounts?.slice(0, 5) ?? []) {
      const balance =
        account.uiAmount ??
        toNumber(account.uiAmountString) ??
        toNumber(account.amount);
      const sharePct =
        balance !== undefined && totalSupply
          ? round((balance / totalSupply) * 100, 3)
          : undefined;
      wallets.push({
        address: account.address,
        label: `Large RPC holder ${wallets.length + 1}`,
        balance,
        sharePct,
        activity: "holder",
        summary:
          sharePct !== undefined
            ? `holds roughly ${round(sharePct, 2)}% of reported supply`
            : "shows up in the largest-account RPC sample",
      });
    }
  }

  for (const trader of snapshot.birdeye?.topTraders?.items ?? []) {
    if (!trader.owner) {
      continue;
    }

    wallets.push({
      address: trader.owner,
      label: `Active trader ${wallets.length + 1}`,
      balance: trader.volume,
      activity: "trader",
      summary:
        trader.volume !== undefined
          ? `moved about $${Math.round(trader.volume).toLocaleString()} over the sampled period`
          : "appears in the top-trader sample",
    });
  }

  return dedupeWallets(wallets).slice(0, 6);
}

function deriveDistribution(snapshot: ProviderSnapshot): TokenDistributionData {
  const totalSupply =
    snapshot.birdeye?.overview?.supply ??
    snapshot.birdeye?.overview?.circulatingSupply ??
    snapshot.rpc?.supply?.uiAmount ??
    toNumber(snapshot.rpc?.supply?.uiAmountString) ??
    snapshot.helius?.token_info?.supply;
  const circulatingSupply =
    snapshot.birdeye?.overview?.circulatingSupply ??
    snapshot.helius?.token_info?.circulating_supply ??
    totalSupply;

  return {
    totalSupply,
    circulatingSupply,
    holderCount: snapshot.birdeye?.holders?.total,
    top10HolderPct: deriveTop10HolderPct(snapshot, totalSupply),
    largestHolderPct: deriveLargestHolderPct(snapshot, totalSupply),
    notableWallets: summarizeHolders(snapshot, totalSupply),
  };
}

export function buildAnalysisReport(
  address: string,
  snapshot: ProviderSnapshot,
): AnalysisReport {
  const token = deriveIdentity(address, snapshot);
  const market = deriveMarket(address, snapshot);
  const security = deriveSecurity(snapshot);
  const distribution = deriveDistribution(snapshot);
  const scores = calculateAnalysisScores({
    market,
    security,
    distribution,
    sources: snapshot.sources,
  });
  const recommendation = generateRecommendation({
    market,
    security,
    distribution,
    scores,
  });
  const warnings = [...snapshot.warnings];

  if (scores.completeness < 0.45) {
    warnings.push({
      code: "LOW_COMPLETENESS",
      message:
        "Several provider signals are missing, so the analysis is intentionally conservative.",
      severity: "info",
    });
  }

  const report: AnalysisReport = {
    address,
    isValid: true,
    analyzedAt: new Date().toISOString(),
    completeness: scores.completeness,
    token,
    market,
    security,
    distribution,
    scores,
    recommendation,
    scenarios: calculateMarketCapScenarios({ market, scores }),
    narrative: "",
    warnings,
    sources: snapshot.sources,
  };

  report.narrative = synthesizeNarrative(report);
  return report;
}

export function createInvalidAddressReport(address: string): AnalysisReport {
  const report: AnalysisReport = {
    address,
    isValid: false,
    analyzedAt: new Date().toISOString(),
    completeness: 0,
    token: {
      address,
      symbol: shortenAddress(address),
      name: "Invalid Solana token address",
    },
    market: {},
    security: {},
    distribution: {
      notableWallets: [],
    },
    scores: calculateAnalysisScores({
      market: {},
      security: {},
      distribution: {
        notableWallets: [],
      },
      sources: [],
    }),
    recommendation: {
      label: "avoid",
      confidence: "low",
      summary: "The supplied address does not parse as a valid Solana token mint.",
      rationale: ["No provider calls were made because address validation failed."],
      caveats: ["Double-check the mint address before using this report."],
    },
    scenarios: [
      {
        name: "bear",
        description: "Scenario modeling is disabled for invalid addresses.",
      },
      {
        name: "base",
        description: "Scenario modeling is disabled for invalid addresses.",
      },
      {
        name: "bull",
        description: "Scenario modeling is disabled for invalid addresses.",
      },
    ],
    narrative:
      "Address validation failed before any market data was requested, so this report intentionally avoids making token-quality claims.",
    warnings: [
      {
        code: "INVALID_SOLANA_ADDRESS",
        message: "The provided address is not a valid Solana public key.",
        severity: "critical",
      },
    ],
    sources: [],
  };

  return report;
}

export async function analyzeSolanaToken(
  address: string,
  options: ProviderOptions = {},
): Promise<AnalysisReport> {
  if (!validateSolanaAddress(address)) {
    return createInvalidAddressReport(address);
  }

  const snapshot = await fetchProviderSnapshot(address, options);
  const report = buildAnalysisReport(address, snapshot);

  const narrativeEnrichment = await enrichNarrativeWithOpenRouter(report, options);
  if (narrativeEnrichment.narrative) {
    report.narrative = narrativeEnrichment.narrative;
  }
  report.sources = [...report.sources, narrativeEnrichment.source];
  if (narrativeEnrichment.warning) {
    report.warnings = [...report.warnings, narrativeEnrichment.warning];
  }

  return report;
}
