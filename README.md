# Frontier AI Memecoin Decision Engine

`Frontier AI Memecoin Decision Engine` is a Vercel-ready Next.js webapp for fast Solana token triage, built for memecoin traders who want a quick but structured read on a contract address before acting.

The app takes any Solana mint, runs the server-side analysis stack, and compiles a trench-friendly report with:

- setup summary
- facts / signals / scenarios
- holder concentration and notable wallet context
- concentration proxy and security context
- security warnings
- buy / watch / avoid style guidance
- scenario market-cap ranges
- AI-written setup framing layered on top of a structured scoring core

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Server-side analysis runtime for Vercel Node

## Environment

Copy `.env.example` locally and fill the required server-side values:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ANALYSIS_API_PATH=/api/analysis
SERVER_CHAIN_KEY=
SERVER_CHAIN_RPC_URL=
SERVER_AI_KEY=
SERVER_AI_MODEL=
SERVER_APP_REFERER=http://localhost:3000
SERVER_APP_TITLE=Frontier AI Memecoin Decision Engine
```

Keep secret keys in server-side env vars only. Do not put any secret in a `NEXT_PUBLIC_` variable.

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
- AI fallback and sanitization behavior

## Vercel Deployment

1. Import the project into Vercel.
2. Add the required server-side environment variables in Vercel.
3. Deploy with the default Node runtime.

This codebase is shaped for on-demand analysis, not long-running websocket ingestion. If you later want always-on new-pair streaming, run that as a separate worker and let this app read cached results.

The app is designed to degrade gracefully when some upstream services are unavailable. Missing credentials should reduce coverage and confidence, not crash the experience.
