"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useFixStore } from "@/lib/fix-store";
import { monacoLanguageForPath } from "@/lib/monaco-lang";
import { ProposedDiffOverlay } from "./ProposedDiffOverlay";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.Editor),
  { ssr: false, loading: () => <EditorSkeleton /> },
);

function EditorSkeleton() {
  return (
    <div className="flex h-full items-center justify-center text-xs text-ink-subtle">
      Loading editor…
    </div>
  );
}

export function EditorPanel() {
  const activeFileId = useFixStore((s) => s.activeFileId);
  const file = useFixStore((s) =>
    activeFileId != null ? s.files[activeFileId] : undefined,
  );
  const setDraft = useFixStore((s) => s.setDraft);
  const saving = useFixStore((s) =>
    activeFileId != null ? s.savingFileIds.has(activeFileId) : false,
  );
  const pendingProposal = useFixStore((s) => s.pendingProposal);

  const language = useMemo(
    () => (file ? monacoLanguageForPath(file.path) : "plaintext"),
    [file],
  );

  if (!file) {
    return (
      <div className="flex h-full flex-1 items-center justify-center text-sm text-ink-subtle">
        Pick a file from the tree to start editing.
      </div>
    );
  }

  if (!file.loaded) {
    return (
      <div className="flex h-full flex-1 items-center justify-center text-sm text-ink-subtle">
        Loading {file.path}…
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-surface-border bg-surface-raised/40 px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono text-ink">{file.path}</span>
          {file.has_draft && (
            <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-300">
              modified
            </span>
          )}
        </div>
        <span className="text-ink-subtle">
          {saving ? "saving…" : file.has_draft ? "unsaved·draft" : "in sync"}
        </span>
      </div>

      {pendingProposal && pendingProposal.file_id === file.id ? (
        <ProposedDiffOverlay />
      ) : (
        <MonacoEditor
          height="100%"
          theme="vs-dark"
          path={file.path}
          language={language}
          value={file.draft_text}
          onChange={(v) => setDraft(file.id, v ?? "")}
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: "on",
            tabSize: 2,
            renderWhitespace: "selection",
          }}
        />
      )}
    </div>
  );
}
