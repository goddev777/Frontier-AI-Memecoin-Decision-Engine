import { LoadingState } from "@/components/report-states";

export default function TokenLoading() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <LoadingState />
      </div>
    </main>
  );
}
