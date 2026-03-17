"use client";

import { ErrorState } from "@/components/report-states";

export default function TokenError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <ErrorState
          message={error.message || "Unable to load this Solana mint right now."}
          onRetry={reset}
        />
      </div>
    </main>
  );
}
