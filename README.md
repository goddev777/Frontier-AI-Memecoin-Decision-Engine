# CA Suggestions

`CA Suggestions` is a Vercel-ready Next.js webapp for fast Solana token triage, built for memecoin traders who want a quick but structured read on a contract address before acting.

The app takes any Solana mint, fans out across market/on-chain/security providers, and compiles a trench-friendly report with:

- setup summary
- facts / signals / scenarios
- holder concentration and notable wallet context
- concentration proxy and security context
- security warnings
- buy / watch / avoid style guidance
- scenario market-cap ranges
- optional OpenRouter free-model narrative enrichment layered on top of a deterministic core

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Server-side provider fan-out for Vercel Node runtime

## Provider Strategy

- `DexScreener`: public pair, liquidity, volume, and price context
- `Helius` / `Solana RPC`: metadata and fallback token account information
- `OpenRouter`: optional AI narrative enrichment, defaulting to `openrouter/free`

The report is intentionally designed to degrade gracefully. Missing API keys should produce partial data and cautious copy, not hard crashes.

## Environment

Copy `.env.example` and fill what you want to enable:

```bash
HELIUS_API_KEY=
SOLANA_RPC_URL=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ANALYSIS_API_PATH=/api/analysis
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
OPENROUTER_HTTP_REFERER=http://localhost:3000
OPENROUTER_APP_TITLE=CA Suggestions
```

Notes:

- `HELIUS_API_KEY` and `SOLANA_RPC_URL` are the main on-chain enrichment inputs for this build.
- `OPENROUTER_API_KEY` is optional. If omitted, the app keeps the deterministic report path only.
- `NEXT_PUBLIC_ANALYSIS_API_PATH` only matters if you want the frontend to call a non-default analysis endpoint. The default is `/api/analysis`.
- Keep secret keys in server-side env vars only. Do not use `NEXT_PUBLIC_` for Helius or OpenRouter secrets.

## Local Development

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Tests

```bash
npm run test
```

The suite covers:

- deterministic scoring
- scenario generation
- conservative recommendation behavior under low completeness
- invalid-address safety
- OpenRouter fallback and sanitization behavior

## Vercel Deployment

1. Import the project into Vercel.
2. Add the environment variables you want enabled.
3. Deploy with the default Node runtime.

This codebase is shaped for on-demand analysis, not long-running websocket ingestion. If you later want always-on new-pair streaming, run that as a separate worker and let this app read cached results.

## Current Constraint

The app is designed to degrade gracefully when some providers are unavailable. Missing API keys should reduce coverage and confidence, not crash the experience.
