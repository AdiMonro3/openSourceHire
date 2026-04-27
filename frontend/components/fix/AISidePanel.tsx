"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { SparklesIcon } from "@/components/Icons";
import { useFixStore } from "@/lib/fix-store";

export function AISidePanel() {
  const activeFileId = useFixStore((s) => s.activeFileId);
  const file = useFixStore((s) =>
    activeFileId != null ? s.files[activeFileId] : undefined,
  );
  const loading = useFixStore((s) => s.proposalLoading);
  const error = useFixStore((s) => s.proposalError);
  const pending = useFixStore((s) => s.pendingProposal);
  const requestAiEdit = useFixStore((s) => s.requestAiEdit);

  const [prompt, setPrompt] = useState("");

  const disabled = !file || loading || !!pending;

  async function onAsk() {
    await requestAiEdit(prompt.trim() || undefined);
    setPrompt("");
  }

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-surface-border bg-surface">
      <div className="border-b border-surface-border px-4 py-3">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
          <SparklesIcon className="h-3.5 w-3.5" />
          Claude co-pilot
        </h3>
        <p className="mt-1 text-[11px] text-ink-subtle">
          Ask Claude to edit the active file. Proposals preview as a diff before landing in your draft.
        </p>
      </div>

      <div className="flex flex-col gap-3 border-b border-surface-border px-4 py-3">
        <label className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
          Extra guidance <span className="text-ink-subtle/60">(optional)</span>
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            file
              ? `e.g. handle the missing-config path without crashing in ${file.path.split("/").pop()}`
              : "Pick a file first"
          }
          disabled={!file}
          rows={5}
          className="resize-none rounded-md border border-surface-border bg-surface-raised/50 px-3 py-2 text-xs text-ink placeholder:text-ink-subtle focus:border-violet-500/60 focus:outline-none disabled:opacity-40"
        />
        <Button
          size="sm"
          variant="primary"
          disabled={disabled}
          onClick={onAsk}
          leadingIcon={<SparklesIcon className="h-3.5 w-3.5" />}
          className="w-full"
        >
          {loading ? "Claude is thinking…" : "Ask Claude to fix this file"}
        </Button>
        {error && (
          <p className="rounded bg-red-500/10 px-2 py-1.5 text-[11px] text-red-300">
            {error}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!file && (
          <p className="text-xs text-ink-subtle">
            Open a file to start collaborating with Claude.
          </p>
        )}
        {file && !pending && !loading && (
          <div className="space-y-2 text-xs text-ink-subtle">
            <p>Tip: the more specific your guidance, the tighter the diff.</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Mention the function or area to touch.</li>
              <li>Call out constraints (style, libraries to avoid).</li>
              <li>Leave blank for a plan-driven pass.</li>
            </ul>
          </div>
        )}
        {pending && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2">
              <Badge tone="accent">pending proposal</Badge>
              <Badge
                tone={
                  pending.confidence === "high"
                    ? "green"
                    : pending.confidence === "low"
                      ? "yellow"
                      : "neutral"
                }
              >
                {pending.confidence}
              </Badge>
            </div>
            {pending.summary_of_change && (
              <p className="text-ink">{pending.summary_of_change}</p>
            )}
            {pending.rationale && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Rationale
                </h4>
                <p className="mt-1 text-ink-muted">{pending.rationale}</p>
              </div>
            )}
            {pending.unresolved.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Unresolved
                </h4>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-muted">
                  {pending.unresolved.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-[11px] text-ink-subtle">
              Review the diff in the editor and accept or reject.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
