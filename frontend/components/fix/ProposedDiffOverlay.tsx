"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { useFixStore } from "@/lib/fix-store";
import { monacoLanguageForPath } from "@/lib/monaco-lang";

const DiffEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.DiffEditor),
  { ssr: false, loading: () => <div className="p-4 text-xs text-ink-subtle">Rendering diff…</div> },
);

function applyStrategy(baseText: string, proposal: { strategy: string; proposed_content: string; range?: { start_line: number; end_line: number } | null }): string {
  if (proposal.strategy === "full_replace") return proposal.proposed_content;
  const range = proposal.range;
  if (!range) return proposal.proposed_content;
  const lines = baseText.split("\n");
  const start = Math.max(1, Math.min(range.start_line, lines.length + 1));
  const end = Math.max(start, Math.min(range.end_line, lines.length));
  const replacement = proposal.proposed_content.split("\n");
  return [...lines.slice(0, start - 1), ...replacement, ...lines.slice(end)].join("\n");
}

export function ProposedDiffOverlay() {
  const proposal = useFixStore((s) => s.pendingProposal);
  const accept = useFixStore((s) => s.acceptProposal);
  const reject = useFixStore((s) => s.rejectProposal);
  const activeFileId = useFixStore((s) => s.activeFileId);
  const file = useFixStore((s) =>
    activeFileId != null ? s.files[activeFileId] : undefined,
  );

  if (!proposal || !file) return null;

  if (proposal.strategy === "no_change_needed") {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-xl space-y-4">
          <Badge tone="yellow">no change suggested</Badge>
          <p className="text-sm text-ink">
            Claude thinks this file is already correct for the issue.
          </p>
          {proposal.rationale && (
            <p className="text-sm text-ink-muted">{proposal.rationale}</p>
          )}
          {proposal.unresolved.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Needs clarification
              </h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
                {proposal.unresolved.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          <Button size="sm" variant="secondary" onClick={reject}>
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  const nextText = applyStrategy(proposal.baseText, proposal);
  const language = monacoLanguageForPath(file.path);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-500/30 bg-violet-500/10 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge tone="accent">proposed edit</Badge>
          <Badge
            tone={
              proposal.confidence === "high"
                ? "green"
                : proposal.confidence === "low"
                  ? "yellow"
                  : "neutral"
            }
          >
            {proposal.confidence} confidence
          </Badge>
          {proposal.summary_of_change && (
            <span className="text-ink-muted">{proposal.summary_of_change}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={reject}>
            Reject
          </Button>
          <Button size="sm" variant="primary" onClick={accept}>
            Accept
          </Button>
        </div>
      </div>

      <div className="flex-1">
        <DiffEditor
          height="100%"
          theme="vs-dark"
          language={language}
          original={proposal.baseText}
          modified={nextText}
          options={{
            readOnly: true,
            renderSideBySide: true,
            fontSize: 13,
            minimap: { enabled: false },
            automaticLayout: true,
          }}
        />
      </div>

      {proposal.rationale && (
        <div className="border-t border-surface-border bg-surface-raised/60 px-4 py-2 text-xs text-ink-muted">
          <span className="text-ink-subtle">Why · </span>
          {proposal.rationale}
        </div>
      )}
    </div>
  );
}
