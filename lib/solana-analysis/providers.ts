import { PublicKey } from "@solana/web3.js";

import type {
  AnalysisWarning,
  DexScreenerPair,
  DexScreenerPairsResponse,
  HeliusAsset,
  HeliusJsonRpcResponse,
  ProviderConfig,
  ProviderOptions,
  ProviderSnapshot,
  SolanaRpcAccountInfoValue,
  SolanaRpcLargestAccount,
  SolanaRpcResponse,
  SolanaRpcTokenSupplyValue,
  SourceAttribution,
  SourceStatus
} from "./types";

const DEFAULT_CONFIG: ProviderConfig = {
  dexScreenerBaseUrl: "https://api.dexscreener.com",
  openRouterBaseUrl: "https://openrouter.ai/api/v1",
  openRouterModel: "openrouter/free"
};

const DEFAULT_PROVIDER_TIMEOUT_MS = 12_000;

interface FetchResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
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

async function parseJsonWithTimeout<T>(response: Response, timeoutMs: number): Promise<T> {
  return (await Promise.race([
    response.json() as Promise<T>,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
    })
  ])) as T;
}

export function getProviderConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    ...DEFAULT_CONFIG,
    heliusApiKey: process.env.HELIUS_API_KEY,
    solanaRpcUrl: process.env.SOLANA_RPC_URL,
    openRouterApiKey: process.env.OPENROUTER_API_KEY,
    openRouterModel: process.env.OPENROUTER_MODEL ?? DEFAULT_CONFIG.openRouterModel,
    openRouterReferer: process.env.OPENROUTER_HTTP_REFERER ?? process.env.NEXT_PUBLIC_APP_URL,
    openRouterTitle: process.env.OPENROUTER_APP_TITLE ?? "CA Suggestions",
    ...overrides
  };
}

function normalizeUrl(baseUrl: string | undefined, path: string): string {
  return new URL(path, `${baseUrl ?? ""}/`).toString();
}

export function toNumber(value: number | string | null | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function createSource(
  provider: SourceAttribution["provider"],
  status: SourceStatus,
  fields: string[],
  note?: string,
  url?: string
): SourceAttribution {
  return { provider, status, fields, note, url };
}

function createWarning(
  code: string,
  message: string,
  severity: AnalysisWarning["severity"],
  provider?: AnalysisWarning["provider"]
): AnalysisWarning {
  return { code, message, severity, provider };
}

async function safeFetchJson<T>(
  fetchImpl: typeof fetch,
  url: string,
  init?: RequestInit
): Promise<FetchResult<T>> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const response = (await Promise.race([
      fetchImpl(url, {
        ...init,
        signal: controller.signal
      }),
      new Promise<Response>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new Error(`Timed out after ${DEFAULT_PROVIDER_TIMEOUT_MS}ms`));
        }, DEFAULT_PROVIDER_TIMEOUT_MS);
      })
    ])) as Response;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `HTTP ${response.status}`
      };
    }

    return {
      ok: true,
      status: response.status,
      data: await parseJsonWithTimeout<T>(response, DEFAULT_PROVIDER_TIMEOUT_MS)
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "AbortError" || /Timed out/.test(error.message)
          ? `Timed out after ${DEFAULT_PROVIDER_TIMEOUT_MS}ms`
          : error.message
        : "Unknown fetch failure";
    return {
      ok: false,
      status: 0,
      error: message
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function postJson<T>(
  fetchImpl: typeof fetch,
  url: string,
  body: unknown,
  headers?: HeadersInit
): Promise<FetchResult<T>> {
  return safeFetchJson<T>(fetchImpl, url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });
}

export function validateSolanaAddress(address: string): boolean {
  try {
    const key = new PublicKey(address);
    return PublicKey.isOnCurve(key.toBytes()) || key.toBase58() === address;
  } catch {
    return false;
  }
}

function getRpcEndpoint(config: ProviderConfig): string | undefined {
  if (config.solanaRpcUrl) {
    return config.solanaRpcUrl;
  }

  if (config.heliusApiKey) {
    return `https://mainnet.helius-rpc.com/?api-key=${config.heliusApiKey}`;
  }

  return "https://api.mainnet-beta.solana.com";
}

export function selectBestDexPair(
  pairs: DexScreenerPair[] | undefined,
  tokenAddress: string
): DexScreenerPair | undefined {
  if (!pairs?.length) {
    return undefined;
  }

  const ranked = [...pairs]
    .filter((pair) => pair.chainId?.toLowerCase() === "solana")
    .filter((pair) => pair.baseToken?.address === tokenAddress)
    .sort((left, right) => {
      const leftScore =
        (left.liquidity?.usd ?? 0) * 4 +
        (left.volume?.h24 ?? 0) +
        (left.txns?.h24?.buys ?? 0) * 250 +
        (left.txns?.h24?.sells ?? 0) * 250;
      const rightScore =
        (right.liquidity?.usd ?? 0) * 4 +
        (right.volume?.h24 ?? 0) +
        (right.txns?.h24?.buys ?? 0) * 250 +
        (right.txns?.h24?.sells ?? 0) * 250;

      return rightScore - leftScore;
    });

  return ranked[0];
}

async function fetchDexScreener(
  address: string,
  fetchImpl: typeof fetch,
  config: ProviderConfig
): Promise<{
  data?: DexScreenerPairsResponse;
  source: SourceAttribution;
  warning?: AnalysisWarning;
}> {
  const url = normalizeUrl(config.dexScreenerBaseUrl, `/latest/dex/tokens/${address}`);
  const response = await safeFetchJson<DexScreenerPairsResponse>(fetchImpl, url);

  if (!response.ok) {
    return {
      source: createSource("dexscreener", "error", ["pairs"], response.error ?? "DexScreener request failed", url),
      warning: createWarning(
        "DEXSCREENER_FETCH_FAILED",
        "DexScreener data could not be loaded.",
        "warning",
        "dexscreener"
      )
    };
  }

  return {
    data: response.data,
    source: createSource(
      "dexscreener",
      response.data?.pairs?.length ? "success" : "partial",
      ["pairs", "liquidity", "price", "volume"],
      response.data?.pairs?.length ? undefined : "No Solana pairs were returned.",
      url
    )
  };
}

async function fetchHeliusAsset(
  address: string,
  fetchImpl: typeof fetch,
  config: ProviderConfig
): Promise<{
  data?: HeliusAsset;
  source: SourceAttribution;
  warning?: AnalysisWarning;
}> {
  if (!config.heliusApiKey) {
    return {
      source: createSource("helius", "skipped", ["asset"], "Missing HELIUS_API_KEY.")
    };
  }

  const url =
    config.heliusRpcBaseUrl ??
    `https://mainnet.helius-rpc.com/?api-key=${config.heliusApiKey}`;
  const response = await postJson<HeliusJsonRpcResponse<HeliusAsset>>(fetchImpl, url, {
    jsonrpc: "2.0",
    id: "asset",
    method: "getAsset",
    params: {
      id: address
    }
  });

  if (!response.ok || response.data?.error) {
    return {
      source: createSource(
        "helius",
        "error",
        ["asset"],
        response.data?.error?.message ?? response.error ?? "Helius request failed",
        url
      ),
      warning: createWarning("HELIUS_FETCH_FAILED", "Helius asset metadata could not be loaded.", "warning", "helius")
    };
  }

  return {
    data: response.data?.result,
    source: createSource("helius", "success", ["asset"], undefined, url)
  };
}

async function fetchRpcFallback(
  address: string,
  fetchImpl: typeof fetch,
  config: ProviderConfig
): Promise<{
  data?: ProviderSnapshot["rpc"];
  source: SourceAttribution;
  warning?: AnalysisWarning;
}> {
  const url = getRpcEndpoint(config);
  if (!url) {
    return {
      source: createSource("solana-rpc", "skipped", ["mint", "supply", "largestAccounts"], "Missing SOLANA_RPC_URL.")
    };
  }

  const [accountInfo, tokenSupply, largestAccounts] = await Promise.all([
    postJson<SolanaRpcResponse<{ value?: SolanaRpcAccountInfoValue }>>(fetchImpl, url, {
      jsonrpc: "2.0",
      id: "mint",
      method: "getAccountInfo",
      params: [address, { encoding: "jsonParsed" }]
    }),
    postJson<SolanaRpcResponse<SolanaRpcTokenSupplyValue>>(fetchImpl, url, {
      jsonrpc: "2.0",
      id: "supply",
      method: "getTokenSupply",
      params: [address]
    }),
    postJson<SolanaRpcResponse<{ value?: SolanaRpcLargestAccount[] }>>(fetchImpl, url, {
      jsonrpc: "2.0",
      id: "largest-accounts",
      method: "getTokenLargestAccounts",
      params: [address]
    })
  ]);

  const data = {
    mint: accountInfo.data?.result?.value?.data?.parsed?.info,
    supply: tokenSupply.data?.result,
    largestAccounts: largestAccounts.data?.result?.value
  };
  const successes = [accountInfo, tokenSupply, largestAccounts].filter(
    (result) => result.ok && !result.data?.error
  ).length;

  return {
    data,
    source: createSource(
      "solana-rpc",
      successes === 3 ? "success" : successes > 0 ? "partial" : "error",
      ["mint", "supply", "largestAccounts"],
      successes === 3 ? undefined : "RPC fallback returned partial token metadata.",
      url
    ),
    warning:
      successes === 0
        ? createWarning(
            "SOLANA_RPC_FETCH_FAILED",
            "Generic Solana RPC fallback could not be loaded.",
            "warning",
            "solana-rpc"
          )
        : undefined
  };
}

export async function fetchProviderSnapshot(
  address: string,
  options: ProviderOptions = {}
): Promise<ProviderSnapshot> {
  const fetchImpl = getFetch(options.fetchImpl);
  const config = getProviderConfig(options.config);

  const [dexScreener, helius, rpc] = await Promise.all([
    fetchDexScreener(address, fetchImpl, config),
    fetchHeliusAsset(address, fetchImpl, config),
    fetchRpcFallback(address, fetchImpl, config)
  ]);

  return {
    dexScreener: dexScreener.data,
    helius: helius.data,
    rpc: rpc.data,
    sources: [dexScreener.source, helius.source, rpc.source],
    warnings: [...[dexScreener.warning, helius.warning, rpc.warning].filter(Boolean)] as AnalysisWarning[]
  };
}
