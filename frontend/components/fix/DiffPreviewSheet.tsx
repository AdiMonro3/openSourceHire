"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { fixApi, type DiffResponse } from "@/lib/fix-api";
import { useFixStore } from "@/lib/fix-store";
import { SubmitConfirmModal } from "./SubmitConfirmModal";

type Props = {
  onClose: () => void;
};

export function DiffPreviewSheet({ onClose }: Props) {
  const session = useFixStore((s) => s.session);
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fixApi
      .diff(session.id)
      .then(setDiff)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [session]);

  if (!session) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center sm:p-6"
        onClick={onClose}
      >
        <div
          className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-surface-border bg-surface-raised shadow-2xl sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-surface-border px-5 py-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Review your changes</h2>
              {diff && (
                <p className="mt-0.5 text-xs text-ink-subtle">
                  {diff.files.length} file{diff.files.length === 1 ? "" : "s"} ·
                  <span className="ml-1 text-emerald-300">+{diff.total_additions}</span>
                  <span className="ml-1 text-red-300">−{diff.total_deletions}</span>
                </p>
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {loading && <p className="text-sm text-ink-subtle">Computing diff…</p>}
            {error && (
              <p className="rounded bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}
            {diff && diff.files.length === 0 && (
              <p className="text-sm text-ink-subtle">
                No pending edits. Make a change to open a PR.
              </p>
            )}
            {diff?.files.map((f) => (
              <div
                key={f.path}
                className="mb-4 overflow-hidden rounded-lg border border-surface-border"
              >
                <div className="flex items-center justify-between border-b border-surface-border bg-surface/60 px-3 py-2 text-xs">
                  <span className="truncate font-mono text-ink">{f.path}</span>
                  <span className="shrink-0">
                    <span className="text-emerald-300">+{f.additions}</span>
                    <span className="ml-1 text-red-300">−{f.deletions}</span>
                  </span>
                </div>
                <pre className="max-h-80 overflow-auto bg-surface p-3 font-mono text-[11px] leading-relaxed">
                  {f.diff.split("\n").map((line, i) => (
                    <div
                      key={i}
                      className={clsx(
                        line.startsWith("+") && !line.startsWith("+++")
                          ? "text-emerald-300"
                          : line.startsWith("-") && !line.startsWith("---")
                            ? "text-red-300"
                            : line.startsWith("@@")
                              ? "text-violet-300"
                              : "text-ink-muted",
                      )}
                    >
                      {line || "\u00A0"}
                    </div>
                  ))}
                </pre>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-surface-border bg-surface/60 px-5 py-3">
            <div className="text-xs text-ink-subtle">
              <Badge tone="neutral">heads up</Badge>
              <span className="ml-2">
                Upstream CI runs after the PR opens. We do not execute code here.
              </span>
            </div>
            <Button
              size="sm"
              variant="primary"
              disabled={!diff || diff.files.length === 0 || session.state !== "draft"}
              onClick={() => setConfirming(true)}
            >
              Open PR…
            </Button>
          </div>
        </div>
      </div>

      {confirming && (
        <SubmitConfirmModal
          onClose={() => setConfirming(false)}
          onSubmitted={() => {
            setConfirming(false);
            onClose();
          }}
        />
      )}
    </>
  );
}
