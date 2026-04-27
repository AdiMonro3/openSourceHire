"use client";

import { useEffect, useState, useMemo } from "react";
import { useFixStore } from "@/lib/fix-store";
import { FixToolbar } from "./FixToolbar";
import { FileTreePanel } from "./FileTreePanel";
import { EditorPanel } from "./EditorPanel";
import { AISidePanel } from "./AISidePanel";
import { DiffPreviewSheet } from "./DiffPreviewSheet";

type Props = {
  issueId: number;
};

export function FixWorkspace({ issueId }: Props) {
  const boot = useFixStore((s) => s.boot);
  const reset = useFixStore((s) => s.reset);
  const booted = useFixStore((s) => s.booted);
  const bootError = useFixStore((s) => s.bootError);
  const session = useFixStore((s) => s.session);
  const files = useFixStore((s) => s.files);
  const fileOrder = useFixStore((s) => s.fileOrder);
  const currentIssueId = useFixStore((s) => s.issueId);

  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (currentIssueId !== issueId) {
      void boot(issueId);
    }
    return () => {
      // Keep state across tab toggles; only reset on full unmount by navigation.
    };
  }, [issueId, currentIssueId, boot]);

  useEffect(() => () => reset(), [reset]);

  const modifiedCount = useMemo(
    () => fileOrder.reduce((n, id) => (files[id]?.has_draft ? n + 1 : n), 0),
    [files, fileOrder],
  );

  if (!booted) {
    return (
      <div className="flex h-[70vh] items-center justify-center text-sm text-ink-subtle">
        Spinning up your fix session…
      </div>
    );
  }

  if (bootError) {
    const antiAi = bootError.toLowerCase().includes("anti-ai") ||
      bootError.toLowerCase().includes("opted out");
    return (
      <div className="mx-auto mt-8 max-w-lg rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300">
        <p className="font-semibold">
          {antiAi
            ? "This maintainer has opted out of AI-assisted contributions."
            : "Could not start fix session"}
        </p>
        <p className="mt-1 text-xs text-red-300/80">{bootError}</p>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col overflow-hidden rounded-2xl border border-surface-border bg-surface">
      <FixToolbar
        modified={modifiedCount}
        onPreview={() => setPreviewing(true)}
      />
      <div className="flex min-h-0 flex-1">
        <FileTreePanel />
        <div className="flex min-w-0 flex-1">
          <EditorPanel />
        </div>
        <AISidePanel />
      </div>

      {previewing && (
        <DiffPreviewSheet onClose={() => setPreviewing(false)} />
      )}
    </div>
  );
}
