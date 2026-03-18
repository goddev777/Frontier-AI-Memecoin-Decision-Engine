"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowRight, ClipboardPaste, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { isProbablySolanaMint, normalizeMint } from "@/app/_lib/analysis-api";

type MintSearchProps = {
  initialMint?: string;
  mode: "home" | "token";
};

const SAMPLE_MINTS = [
  {
    label: "BONK",
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    note: "High-recognition meme benchmark"
  },
  {
    label: "JUP",
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    note: "Deep-liquidity routing benchmark"
  },
  {
    label: "FART",
    mint: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump",
    note: "High-beta meme momentum read"
  }
] as const;

export function MintSearch({ initialMint = "", mode }: MintSearchProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialMint);
  const [validationMessage, setValidationMessage] = useState("");
  const [clipboardMessage, setClipboardMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setValue(initialMint);
  }, [initialMint]);

  const helperText = useMemo(() => {
    if (validationMessage) {
      return validationMessage;
    }

    if (clipboardMessage) {
      return clipboardMessage;
    }

    return mode === "home"
      ? "Paste any Solana mint to trigger the AI-first decision engine with setup framing, wallet texture, scenario ranges, and trade breakers."
      : "Jump to another mint instantly without leaving the AI decision workspace.";
  }, [clipboardMessage, mode, validationMessage]);

  async function handlePasteFromClipboard() {
    if (!navigator.clipboard?.readText) {
      setClipboardMessage("Clipboard access is not available in this browser.");
      return;
    }

    try {
      const clipboardValue = normalizeMint(await navigator.clipboard.readText());

      if (!clipboardValue) {
        setClipboardMessage("Clipboard is empty or did not contain a mint.");
        return;
      }

      setValue(clipboardValue);
      setValidationMessage("");
      setClipboardMessage("Mint pasted from clipboard.");
    } catch {
      setClipboardMessage("Clipboard read was blocked. Paste manually if needed.");
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const mint = normalizeMint(value);

    if (!mint) {
      setValidationMessage("Enter a Solana mint to continue.");
      setClipboardMessage("");
      return;
    }

    if (!isProbablySolanaMint(mint)) {
      setValidationMessage("Mint format looks off. Solana mints are base58 and usually 32-44 chars.");
      setClipboardMessage("");
      return;
    }

    setValidationMessage("");
    setClipboardMessage("");

    startTransition(() => {
      const destination =
        mode === "home" ? `/?mint=${encodeURIComponent(mint)}` : `/token/${encodeURIComponent(mint)}`;

      router.push(destination);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="terminal-shell rounded-[34px] p-5 sm:p-7">
      <div className="grid gap-5 xl:grid-cols-[1.25fr,0.75fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan/20 bg-cyan/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.28em] text-cyan">
              <Sparkles className="h-3.5 w-3.5" />
              Frontier AI Terminal
            </div>
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-mute">
              Memecoin decision engine
            </div>
          </div>

          <div className="space-y-3">
            <p className="terminal-heading">AI-First Solana Intelligence</p>
            <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-balance text-ink sm:text-5xl xl:text-6xl">
              Scan the contract.
              <br />
              Let frontier AI read the setup.
              <br />
              Decide fast.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-mute sm:text-[1.04rem]">
              An AI-first memecoin terminal for fast-moving Solana traders. It fuses raw market data, holder structure,
              and frontier-model judgment into one decision surface before you size.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <p className="terminal-heading">Surface</p>
              <p className="mt-2 text-sm font-medium text-ink">AI thesis / signals / scenarios</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <p className="terminal-heading">Context</p>
              <p className="mt-2 text-sm font-medium text-ink">Holders, bundles, notable wallets</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <p className="terminal-heading">Engine</p>
              <p className="mt-2 text-sm font-medium text-ink">Frontier AI anchored in live market data</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.045] p-4">
            <p className="terminal-heading">Built For</p>
            <p className="mt-3 text-lg font-semibold text-ink">Trenchers who want AI-assisted conviction without losing the receipts.</p>
            <p className="mt-2 text-sm leading-6 text-mute">
              Use it as a fast decision pass before entries, trims, or outright skips.
            </p>
          </div>
          <div className="rounded-[28px] border border-lime/15 bg-lime/[0.08] p-4">
            <p className="terminal-heading !text-lime">Design Goal</p>
            <p className="mt-3 text-lg font-semibold text-ink">Make frontier-model analysis feel premium, immediate, and trader-native.</p>
            <p className="mt-2 text-sm leading-6 text-mute">
              Mobile-friendly, desktop-dense, and unmistakably AI-first in the hierarchy.
            </p>
          </div>
        </div>
      </div>

      <div className="my-6 terminal-rule" />

      <div className="rounded-[28px] border border-white/10 bg-[rgba(6,10,16,0.7)] p-3 sm:p-4">
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
                if (clipboardMessage) {
                  setClipboardMessage("");
                }
              }}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Paste a Solana mint for AI decisioning"
              className="h-14 w-full rounded-[22px] border border-white/10 bg-black/20 pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-mute/60 focus:border-cyan/50 focus:bg-black/30"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-[auto,auto]">
            <button
              type="button"
              onClick={() => void handlePasteFromClipboard()}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-[22px] border border-white/10 bg-white/[0.05] px-5 text-sm font-medium text-ink transition hover:border-cyan/35 hover:text-cyan"
            >
              <ClipboardPaste className="h-4 w-4" />
              Paste
            </button>

            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-[22px] border border-lime/25 bg-lime/15 px-6 text-sm font-semibold text-lime transition hover:border-lime/60 hover:bg-lime/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Routing..." : "Run AI analysis"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <p className="max-w-2xl text-sm leading-6 text-mute">{helperText}</p>

          <div className="grid gap-2 sm:grid-cols-3 xl:w-[420px]">
            {SAMPLE_MINTS.map((sample) => (
              <button
                key={sample.mint}
                type="button"
                onClick={() => {
                  setValue(sample.mint);
                  setValidationMessage("");
                  setClipboardMessage("");
                }}
                className="rounded-[18px] border border-white/10 bg-white/5 px-3 py-3 text-left transition hover:border-cyan/35 hover:bg-white/[0.08]"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">{sample.label}</p>
                <p className="mt-1 text-xs leading-5 text-mute">{sample.note}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </form>
  );
}
