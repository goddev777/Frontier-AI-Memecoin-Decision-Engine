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

function summarizeAuthorityScopes(scopes?: string[]): string {
  if (!scopes?.length) {
    return "authority permissions";
  }

  return scopes
    .slice(0, 2)
    .map((scope) => scope.replaceAll("_", " "))
    .join(" / ");
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
  const asset = snapshot.helius;

  return {
    address,
    symbol:
      pair?.baseToken?.symbol ?? asset?.content?.metadata?.symbol ?? shortenAddress(address),
    name:
      pair?.baseToken?.name ?? asset?.content?.metadata?.name ?? "Unknown token",
    decimals: snapshot.rpc?.mint?.decimals ?? snapshot.helius?.token_info?.decimals,
    logoUrl: asset?.content?.links?.image,
    description: asset?.content?.metadata?.description,
  };
}

function deriveMarket(address: string, snapshot: ProviderSnapshot): TokenMarketData {
  const pair = selectBestDexPair(snapshot.dexScreener?.pairs, address);

  return {
    priceUsd:
      toNumber(pair?.priceUsd) ?? snapshot.helius?.token_info?.price_info?.price_per_token,
    marketCapUsd: pair?.marketCap,
    fullyDilutedValuationUsd: pair?.fdv,
    liquidityUsd: pair?.liquidity?.usd,
    volume24hUsd: pair?.volume?.h24,
    priceChange24hPct: pair?.priceChange?.h24,
    buys24h: pair?.txns?.h24?.buys,
    sells24h: pair?.txns?.h24?.sells,
    selectedPair: deriveSelectedPair(address, snapshot),
  };
}

function deriveSecurity(snapshot: ProviderSnapshot): TokenSecurityData {
  const helius = snapshot.helius?.token_info;
  const heliusAuthorities = snapshot.helius?.authorities ?? [];
  const rpcMint = snapshot.rpc?.mint;
  const mintAuthority = helius?.mint_authority ?? rpcMint?.mintAuthority;
  const freezeAuthority = helius?.freeze_authority ?? rpcMint?.freezeAuthority;
  const mintable =
    mintAuthority !== undefined
      ? Boolean(mintAuthority)
      : undefined;
  const freezable =
    freezeAuthority !== undefined
      ? Boolean(freezeAuthority)
      : undefined;

  return {
    mutableMetadata: undefined,
    mintable,
    freezable,
    transferFeeEnabled: undefined,
    mintAuthority: mintAuthority ?? null,
    freezeAuthority: freezeAuthority ?? null,
    creatorAddress:
      heliusAuthorities.find((authority) => authority.address)?.address ??
      snapshot.helius?.ownership?.owner,
    verified:
      mintAuthority === null &&
      freezeAuthority === null &&
      mintable === false &&
      freezable === false,
  };
}

function deriveLargestHolderPct(
  snapshot: ProviderSnapshot,
  totalSupply?: number,
): number | undefined {
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
      label: `Large token account ${wallets.length + 1}`,
      balance,
      sharePct,
      activity: "holder",
      summary:
        sharePct !== undefined
          ? `shows roughly ${round(sharePct, 2)}% of reported supply in the RPC largest-account sample`
          : "shows up in the largest-account RPC sample",
    });
  }

  const authorityAddresses = new Map<string, string>();
  for (const authority of snapshot.helius?.authorities ?? []) {
    if (!authority.address) {
      continue;
    }

    authorityAddresses.set(
      authority.address,
      authority.scopes?.length
        ? `${summarizeAuthorityScopes(authority.scopes)} surfaced via Helius authorities`
        : "authority surfaced via Helius asset metadata"
    );
  }

  if (snapshot.helius?.ownership?.owner) {
    authorityAddresses.set(
      snapshot.helius.ownership.owner,
      "current asset owner surfaced via Helius metadata"
    );
  }

  if (snapshot.helius?.token_info?.mint_authority) {
    authorityAddresses.set(
      snapshot.helius.token_info.mint_authority,
      "mint authority remains active"
    );
  }

  if (snapshot.helius?.token_info?.freeze_authority) {
    authorityAddresses.set(
      snapshot.helius.token_info.freeze_authority,
      "freeze authority remains active"
    );
  }

  for (const [address, summary] of authorityAddresses) {
    wallets.push({
      address,
      label: `Authority ${wallets.length + 1}`,
      activity: "authority",
      summary,
    });
  }

  return dedupeWallets(wallets).slice(0, 6);
}

function deriveDistribution(snapshot: ProviderSnapshot): TokenDistributionData {
  const totalSupply =
    snapshot.rpc?.supply?.uiAmount ??
    toNumber(snapshot.rpc?.supply?.uiAmountString) ??
    snapshot.helius?.token_info?.supply;
  const circulatingSupply =
    snapshot.helius?.token_info?.circulating_supply ?? totalSupply;

  return {
    totalSupply,
    circulatingSupply,
    holderCount: undefined,
    sampledHolderCount: snapshot.rpc?.largestAccounts?.length,
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
