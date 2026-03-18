export type ProviderName =
  | "dexscreener"
  | "helius"
  | "solana-rpc"
  | "openrouter";

export type SourceStatus = "success" | "partial" | "skipped" | "error";

export type ConfidenceLevel = "low" | "medium" | "high";

export type RecommendationLabel =
  | "avoid"
  | "watch"
  | "speculative"
  | "constructive";

export interface AnalysisWarning {
  code: string;
  message: string;
  severity: "info" | "warning" | "critical";
  provider?: ProviderName;
}

export interface SourceAttribution {
  provider: ProviderName;
  status: SourceStatus;
  url?: string;
  fields: string[];
  note?: string;
}

export interface DexScreenerTokenRef {
  address?: string;
  name?: string;
  symbol?: string;
}

export interface DexScreenerTransactionsBucket {
  buys?: number;
  sells?: number;
}

export interface DexScreenerPair {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  labels?: string[];
  baseToken?: DexScreenerTokenRef;
  quoteToken?: DexScreenerTokenRef;
  priceUsd?: string;
  priceNative?: string;
  fdv?: number;
  marketCap?: number;
  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };
  volume?: {
    h24?: number;
    h6?: number;
    h1?: number;
    m5?: number;
  };
  priceChange?: {
    h24?: number;
    h6?: number;
    h1?: number;
    m5?: number;
  };
  txns?: {
    h24?: DexScreenerTransactionsBucket;
    h6?: DexScreenerTransactionsBucket;
    h1?: DexScreenerTransactionsBucket;
    m5?: DexScreenerTransactionsBucket;
  };
}

export interface DexScreenerPairsResponse {
  schemaVersion?: string;
  pairs?: DexScreenerPair[];
}

export interface HeliusErrorPayload {
  code: number;
  message: string;
}

export interface HeliusJsonRpcResponse<T> {
  jsonrpc?: string;
  id?: string;
  result?: T;
  error?: HeliusErrorPayload;
}

export interface HeliusAsset {
  interface?: string;
  id?: string;
  content?: {
    links?: {
      image?: string;
    };
    metadata?: {
      description?: string;
      symbol?: string;
      name?: string;
    };
  };
  authorities?: Array<{
    address?: string;
    scopes?: string[];
  }>;
  ownership?: {
    owner?: string;
  };
  token_info?: {
    decimals?: number;
    supply?: number;
    circulating_supply?: number;
    mint_authority?: string | null;
    freeze_authority?: string | null;
    price_info?: {
      price_per_token?: number;
      total_price?: number;
      currency?: string;
    };
  };
}

export interface SolanaRpcResponse<T> {
  jsonrpc?: string;
  id?: string;
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

export interface SolanaRpcMintInfo {
  decimals?: number;
  supply?: string;
  mintAuthority?: string | null;
  freezeAuthority?: string | null;
  isInitialized?: boolean;
}

export interface SolanaRpcAccountInfoValue {
  data?: {
    parsed?: {
      info?: SolanaRpcMintInfo;
      type?: string;
    };
  };
}

export interface SolanaRpcTokenSupplyValue {
  amount: string;
  decimals: number;
  uiAmount?: number;
  uiAmountString?: string;
}

export interface SolanaRpcLargestAccount {
  address: string;
  amount: string;
  uiAmount?: number;
  uiAmountString?: string;
}

export interface OpenRouterChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterChatCompletionResponse {
  id?: string;
  model?: string;
  provider?: string;
  choices?: Array<{
    index?: number;
    finish_reason?: string;
    message?: {
      role?: string;
      content?: string;
    };
  }>;
}

export interface ProviderConfig {
  heliusApiKey?: string;
  solanaRpcUrl?: string;
  openRouterApiKey?: string;
  openRouterModel?: string;
  dexScreenerBaseUrl?: string;
  heliusRpcBaseUrl?: string;
  openRouterBaseUrl?: string;
  openRouterReferer?: string;
  openRouterTitle?: string;
}

export interface ProviderOptions {
  fetchImpl?: typeof fetch;
  config?: Partial<ProviderConfig>;
}

export interface ProviderSnapshot {
  dexScreener?: DexScreenerPairsResponse;
  helius?: HeliusAsset;
  rpc?: {
    supply?: SolanaRpcTokenSupplyValue;
    mint?: SolanaRpcMintInfo;
    largestAccounts?: SolanaRpcLargestAccount[];
  };
  sources: SourceAttribution[];
  warnings: AnalysisWarning[];
}

export interface SelectedPairSummary {
  pairAddress?: string;
  url?: string;
  dexId?: string;
  quoteSymbol?: string;
  liquidityUsd?: number;
  volume24hUsd?: number;
}

export interface TokenIdentity {
  address: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  logoUrl?: string;
  description?: string;
}

export interface NotableWallet {
  address: string;
  label: string;
  balance?: number;
  sharePct?: number;
  activity: "holder" | "trader" | "authority";
  summary: string;
}

export interface TokenMarketData {
  priceUsd?: number;
  marketCapUsd?: number;
  fullyDilutedValuationUsd?: number;
  liquidityUsd?: number;
  volume24hUsd?: number;
  priceChange24hPct?: number;
  buys24h?: number;
  sells24h?: number;
  selectedPair?: SelectedPairSummary;
}

export interface TokenSecurityData {
  mutableMetadata?: boolean;
  mintable?: boolean;
  freezable?: boolean;
  transferFeeEnabled?: boolean;
  mintAuthority?: string | null;
  freezeAuthority?: string | null;
  creatorAddress?: string;
  verified?: boolean;
}

export interface TokenDistributionData {
  totalSupply?: number;
  circulatingSupply?: number;
  holderCount?: number;
  sampledHolderCount?: number;
  top10HolderPct?: number;
  largestHolderPct?: number;
  notableWallets: NotableWallet[];
}

export interface AnalysisMetricScore {
  value: number;
  label: "weak" | "mixed" | "strong";
  explanation: string;
  weight: number;
  available: boolean;
}

export interface AnalysisScores {
  overall: number;
  liquidity: AnalysisMetricScore;
  activity: AnalysisMetricScore;
  distribution: AnalysisMetricScore;
  trust: AnalysisMetricScore;
  completeness: number;
  confidence: ConfidenceLevel;
}

export interface Recommendation {
  label: RecommendationLabel;
  confidence: ConfidenceLevel;
  summary: string;
  rationale: string[];
  caveats: string[];
}

export interface MarketCapScenario {
  name: "bear" | "base" | "bull";
  impliedMarketCapUsd?: number;
  impliedPriceUsd?: number;
  multipleVsCurrent?: number;
  description: string;
}

export interface AnalysisReport {
  address: string;
  isValid: boolean;
  analyzedAt: string;
  completeness: number;
  token: TokenIdentity;
  market: TokenMarketData;
  security: TokenSecurityData;
  distribution: TokenDistributionData;
  scores: AnalysisScores;
  recommendation: Recommendation;
  scenarios: MarketCapScenario[];
  narrative: string;
  warnings: AnalysisWarning[];
  sources: SourceAttribution[];
}
