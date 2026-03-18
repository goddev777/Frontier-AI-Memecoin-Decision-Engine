import { AnalysisScreen } from "@/components/analysis-screen";

export default async function TokenDetailPage({
  params
}: {
  params: Promise<{ mint: string }>;
}) {
  const { mint } = await params;

  return <AnalysisScreen mode="token" initialMint={mint} />;
}
