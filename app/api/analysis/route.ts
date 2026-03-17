import { NextResponse } from "next/server";

import { buildAnalysisReport, createInvalidAddressReport, enrichNarrativeWithOpenRouter, fetchProviderSnapshot, synthesizeNarrative, validateSolanaAddress } from "@/lib/solana-analysis";
import { toUiAnalysisReport } from "@/lib/solana-analysis/ui-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mint = searchParams.get("mint")?.trim();

  if (!mint) {
    return NextResponse.json(
      { error: "Missing Solana mint address." },
      { status: 400 }
    );
  }

  try {
    if (!validateSolanaAddress(mint)) {
      const invalidReport = createInvalidAddressReport(mint);
      return NextResponse.json(
        toUiAnalysisReport(invalidReport, {
          sources: [],
          warnings: []
        }),
        {
          headers: {
            "Cache-Control": "no-store"
          }
        }
      );
    }

    const snapshot = await fetchProviderSnapshot(mint);
    const report = buildAnalysisReport(mint, snapshot);
    report.narrative = synthesizeNarrative(report);

    const narrativeEnrichment = await enrichNarrativeWithOpenRouter(report);
    if (narrativeEnrichment.narrative) {
      report.narrative = narrativeEnrichment.narrative;
    }
    report.sources = [...report.sources, narrativeEnrichment.source];
    if (narrativeEnrichment.warning) {
      report.warnings = [...report.warnings, narrativeEnrichment.warning];
    }

    return NextResponse.json(toUiAnalysisReport(report, snapshot), {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown analysis error.";

    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
