# Local Memory

## User Preferences
- The user wants important memory captured deliberately, both local and global, and explicitly does not want filler notes.
- For AI features in this project, prefer OpenRouter with a free model/router when possible.
- The user asked for multi-agent execution across planning, orchestration, building, testing, and review.
- The user does not want secrets exposed; Helius and OpenRouter keys must remain server-only and never be moved into `NEXT_PUBLIC_` env vars.
- The user wants OpenRouter AI to be the main differentiator, not an optional side note; AI should drive the report text when available.
- The product’s outward positioning should be AI-first and frontier-model-led; avoid branding it as “AI optional” even when structured fallback paths still exist underneath.

## Project Essentials
- Product: a Solana contract-address analysis webapp for memecoin/new-pair traders ("trenchers").
- UX target: premium trading-terminal feel, fast on mobile and desktop, with clear facts / signals / scenarios.
- Deployment target: Vercel.

## Technical Direction
- Stack: Next.js App Router + TypeScript + Tailwind.
- Core data providers in the current product: DexScreener, Helius, Solana RPC, and optional OpenRouter.
- Birdeye and Bubblemaps were intentionally removed from the product and UI.
- Current deployed local configuration should assume Helius RPC + Helius API + DexScreener as the primary deterministic stack.
- Recommendation flow should stay deterministic first, with optional AI narrative enrichment layered on top.
- Reports should include buy/sell/skip guidance, scenario market-cap ranges, holders, bundle context, notable wallets, and security caveats.
- The client payload should not include source-link sections or bubble-map payloads anymore.
- UI direction: sleek premium trench-terminal feel with stronger hierarchy, cleaner mobile ordering, and a sharper trade-ticket/report-shell presentation.
- Implemented API route: `app/api/analysis/route.ts`.
- Implemented backend engine: `lib/solana-analysis/` with provider fan-out, scoring, OpenRouter enrichment, and a UI adapter that maps engine output into the client report contract.
- OpenRouter defaults to `OPENROUTER_MODEL=openrouter/free` when enabled.
- The current preferred OpenRouter model for local testing is `openrouter/hunter-alpha`, but the app should degrade quickly back to deterministic mode when the model is slow.
- OpenRouter now uses a compact JSON-first prompt and should generate `setup`, `whySurfaced`, `narrative`, and `whatCanBreak` when available.
- Frontend supports `NEXT_PUBLIC_ANALYSIS_API_PATH` for custom analysis endpoints; `.env.example` and README now document it.

## Environment Constraints
- `Node.js 24.14.0` was installed locally during this session and `npm install`, `npm run test`, and `npm run build` now complete successfully in this workspace.
- `git` availability should still be checked per session before assuming commit support.

## Verification State
- Current status at end of this session: tests passing, production build passing.
- Live local dev server still responds with HTTP 200 after the redesign pass.
- After wiring local credentials, a live BONK analysis request returned successfully using the fallback stack, and timeout guards were added to keep slow providers/models from hanging the route indefinitely.
- A real UX regression came from dead demo mints, not a globally broken fetch layer: the previous `WIF` and `POPCAT` sample CAs no longer resolved through DexScreener/Helius, so they were replaced with live `JUP` and `FART` presets.
- Verified after cleanup that the live API payload no longer exposes `sources` or `bubbleMap`.
- Direct OpenRouter calls with the compact JSON prompt succeed locally, but `hunter-alpha` still carries noticeable latency for full report generation compared with simpler prompts.
- Edge cases tightened after review: unknown security data no longer reads as renounced/safe, missing market-cap scenarios no longer render as `$0-$0`, OpenRouter hard failures surface as failures, and concentration proxy status no longer defaults to low risk when data is missing.
