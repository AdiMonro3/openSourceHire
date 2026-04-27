"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { ExternalIcon, GitHubIcon } from "@/components/Icons";
import { ApiError } from "@/lib/api-client";
import { fixApi, type RebaseResponse } from "@/lib/fix-api";
import { useFixStore } from "@/lib/fix-store";

type Props = {
  onClose: () => void;
  onSubmitted: () => void;
};

type SubmitError =
  | { kind: "drift"; new_base_sha: string; files_changed_upstream: string[] }
  | { kind: "fork_collision"; message: string }
  | { kind: "generic"; message: string };

export function SubmitConfirmModal({ onClose, onSubmitted }: Props) {
  const session = useFixStore((s) => s.session);
  const refresh = useFixStore((s) => s.refreshSession);
  const [prTitle, setPrTitle] = useState("");
  const [prBody, setPrBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<SubmitError | null>(null);
  const [rebaseResult, setRebaseResult] = useState<RebaseResponse | null>(null);

  if (!session) return null;

  async function onOpenPr() {
    if (!session) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fixApi.submit(session.id, {
        pr_title: prTitle.trim() || undefined,
        pr_body: prBody.trim() || undefined,
      });
      await refresh();
      onSubmitted();
      if (res.pr_url) window.open(res.pr_url, "_blank", "noopener");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.detail &&
          typeof e.detail === "object" &&
          (e.detail as { conflict?: string }).conflict === "base_sha_drift") {
        const d = e.detail as { new_base_sha?: string; files_changed_upstream?: string[] };
        setError({
          kind: "drift",
          new_base_sha: d.new_base_sha ?? "",
          files_changed_upstream: d.files_changed_upstream ?? [],
        });
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.toLowerCase().includes("fork") && msg.toLowerCase().includes("collision")) {
          setError({ kind: "fork_collision", message: msg });
        } else {
          setError({ kind: "generic", message: msg });
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onRebase() {
    if (!session) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fixApi.rebase(session.id);
      setRebaseResult(res);
      await refresh();
    } catch (e) {
      setError({
        kind: "generic",
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-surface-border bg-surface-raised shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-surface-border px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <GitHubIcon className="h-3.5 w-3.5" />
            <span className="font-mono text-ink">{session.upstream_repo}</span>
            <span className="text-ink-subtle">·</span>
            <span className="font-mono text-ink-subtle">
              {session.default_branch}@{session.base_sha.slice(0, 7)}
            </span>
          </div>
          <h2 className="mt-1 text-sm font-semibold text-ink">
            Open pull request
          </h2>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
              PR title{" "}
              <span className="text-ink-subtle/60">(auto-drafted if empty)</span>
            </label>
            <input
              value={prTitle}
              onChange={(e) => setPrTitle(e.target.value)}
              placeholder="Fix missing-config crash in parse_config"
              className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-violet-500/60 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
              PR body{" "}
              <span className="text-ink-subtle/60">
                (coach will draft one if empty; AI disclosure appended)
              </span>
            </label>
            <textarea
              rows={6}
              value={prBody}
              onChange={(e) => setPrBody(e.target.value)}
              placeholder="Leave blank to let Claude draft it based on your changes…"
              className="w-full resize-y rounded-md border border-surface-border bg-surface px-3 py-2 font-mono text-xs text-ink placeholder:text-ink-subtle focus:border-violet-500/60 focus:outline-none"
            />
          </div>

          <div className="rounded-lg border border-surface-border bg-surface/60 p-3 text-[11px] text-ink-subtle">
            <Badge tone="neutral">before you ship</Badge>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>We&apos;ll fork {session.upstream_repo} if needed, create a branch, and push one commit.</li>
              <li>Upstream CI runs after the PR opens — we don&apos;t run tests here.</li>
              <li>You can keep editing; reopen will PATCH the existing branch.</li>
            </ul>
          </div>

          {error?.kind === "drift" && (
            <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <p className="font-semibold">Upstream moved since you started.</p>
              <p>
                New base: <span className="font-mono">{error.new_base_sha.slice(0, 7)}</span>.
                {error.files_changed_upstream.length > 0 &&
                  ` ${error.files_changed_upstream.length} file(s) also edited upstream.`}
              </p>
              <Button size="sm" variant="secondary" onClick={onRebase} disabled={submitting}>
                Refresh & reconcile
              </Button>
            </div>
          )}

          {rebaseResult && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              Rebased onto{" "}
              <span className="font-mono">{rebaseResult.new_base_sha.slice(0, 7)}</span>.
              {rebaseResult.conflicts.length > 0 ? (
                <>
                  {" "}
                  Review {rebaseResult.conflicts.length} conflicting file(s) before
                  re-submitting.
                </>
              ) : (
                <> No conflicts — you&apos;re clear to submit again.</>
              )}
            </div>
          )}

          {error?.kind === "fork_collision" && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              A non-fork repo already exists with this name on your account.
              Rename it on GitHub, then retry.
            </div>
          )}

          {error?.kind === "generic" && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              {error.message}
            </div>
          )}

          {session.pr_url && (
            <a
              href={session.pr_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200"
            >
              PR #{session.pr_number} is open
              <ExternalIcon className="h-3 w-3" />
            </a>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-surface-border bg-surface/60 px-5 py-3">
          <Button size="sm" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            loading={submitting}
            disabled={submitting || session.state !== "draft"}
            onClick={onOpenPr}
          >
            Open PR
          </Button>
        </div>
      </div>
    </div>
  );
}
