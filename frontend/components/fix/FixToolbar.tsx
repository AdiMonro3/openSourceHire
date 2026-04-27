"use client";

import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { ExternalIcon, GitHubIcon, SparklesIcon } from "@/components/Icons";
import { useFixStore } from "@/lib/fix-store";

type Props = {
  modified: number;
  onPreview: () => void;
};

export function FixToolbar({ modified, onPreview }: Props) {
  const session = useFixStore((s) => s.session);
  if (!session) return null;

  const stateTone =
    session.state === "pr_opened"
      ? "green"
      : session.state === "failed"
        ? "red"
        : session.state === "submitting"
          ? "yellow"
          : "accent";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border bg-surface-raised/60 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
        <GitHubIcon className="h-3.5 w-3.5" />
        <span className="font-mono text-ink">{session.upstream_repo}</span>
        <span className="text-ink-subtle">·</span>
        <span className="font-mono text-ink-subtle">
          {session.default_branch}@{session.base_sha.slice(0, 7)}
        </span>
        <Badge tone={stateTone}>{session.state.replace("_", " ")}</Badge>
        {session.pr_url ? (
          <a
            href={session.pr_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-violet-300 hover:text-violet-200"
          >
            PR #{session.pr_number}
            <ExternalIcon className="h-3 w-3" />
          </a>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-subtle">
          {modified === 0
            ? "no edits yet"
            : `${modified} file${modified === 1 ? "" : "s"} modified`}
        </span>
        <Button
          size="sm"
          variant="primary"
          leadingIcon={<SparklesIcon className="h-3.5 w-3.5" />}
          disabled={modified === 0 || session.state !== "draft"}
          onClick={onPreview}
        >
          Open PR
        </Button>
      </div>
    </div>
  );
}
