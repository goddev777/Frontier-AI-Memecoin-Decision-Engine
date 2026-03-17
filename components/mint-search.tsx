"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { isProbablySolanaMint, normalizeMint } from "@/app/_lib/analysis-api";

type MintSearchProps = {
  initialMint?: string;
  mode: "home" | "token";
};

export function MintSearch({ initialMint = "", mode }: MintSearchProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialMint);
  const [validationMessage, setValidationMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setValue(initialMint);
  }, [initialMint]);

  const helperText = useMemo(() => {
    if (validationMessage) {
      return validationMessage;
    }

    return mode === "home"
      ? "Paste any Solana mint to load the full Trench Intel report."
      : "Switch directly to another mint without leaving the report terminal.";
  }, [mode, validationMessage]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const mint = normalizeMint(value);

    if (!mint) {
      setValidationMessage("Enter a Solana mint to continue.");
      return;
    }

    if (!isProbablySolanaMint(mint)) {
      setValidationMessage("Mint format looks off. Solana mints are base58 and usually 32-44 chars.");
      return;
    }

    setValidationMessage("");

    startTransition(() => {
      const destination =
        mode === "home" ? `/?mint=${encodeURIComponent(mint)}` : `/token/${encodeURIComponent(mint)}`;

      router.push(destination);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="terminal-shell rounded-[28px] p-4 sm:p-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.28em] text-cyan">
            <Sparkles className="h-3.5 w-3.5" />
            Trench Intel Terminal
          </div>
          <div>
            <p className="terminal-heading">Solana Mint Lookup</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-semibold text-balance text-ink sm:text-4xl">
              Separate facts, signals, and scenario ranges before you size a memecoin trade.
            </h1>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-mute sm:text-base">{helperText}</p>
        </div>

        <div className="grid gap-2 text-xs uppercase tracking-[0.2em] text-mute sm:grid-cols-3">
          <div className="terminal-chip rounded-2xl px-3 py-2.5">
            <p>Setup Summary</p>
          </div>
          <div className="terminal-chip rounded-2xl px-3 py-2.5">
            <p>Risk Warnings</p>
          </div>
          <div className="terminal-chip rounded-2xl px-3 py-2.5">
            <p>Scenario Ranges</p>
          </div>
        </div>
      </div>

      <div className="my-4 terminal-rule" />

      <div className="flex flex-col gap-3 xl:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Solana mint</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan" />
          <input
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (validationMessage) {
                setValidationMessage("");
              }
            }}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="So11111111111111111111111111111111111111112"
            className="h-14 w-full rounded-2xl border border-white/10 bg-black/25 pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-mute/60 focus:border-cyan/60 focus:bg-black/35"
          />
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-14 items-center justify-center rounded-2xl border border-lime/30 bg-lime/15 px-6 text-sm font-semibold text-lime transition hover:border-lime/60 hover:bg-lime/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Routing..." : mode === "home" ? "Run analysis" : "Open token report"}
        </button>
      </div>
    </form>
  );
}
