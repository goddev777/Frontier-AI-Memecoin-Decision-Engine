import { AnalysisScreen } from "@/components/analysis-screen";

export default function TokenDetailPage({
  params
}: {
  params: { mint: string };
}) {
  const { mint } = params;

  return <AnalysisScreen mode="token" initialMint={mint} />;
}
