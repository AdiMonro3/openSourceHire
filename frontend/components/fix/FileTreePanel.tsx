"use client";

import clsx from "clsx";
import { useState } from "react";
import { Button } from "@/components/Button";
import { useFixStore } from "@/lib/fix-store";
import { TreeBrowserModal } from "./TreeBrowserModal";

export function FileTreePanel() {
  const files = useFixStore((s) => s.files);
  const order = useFixStore((s) => s.fileOrder);
  const activeFileId = useFixStore((s) => s.activeFileId);
  const setActiveFile = useFixStore((s) => s.setActiveFile);
  const removeFile = useFixStore((s) => s.removeFile);
  const [browserOpen, setBrowserOpen] = useState(false);

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-surface-border bg-surface">
      <div className="flex items-center justify-between px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
        <span>Files in session</span>
      </div>
      <ul className="flex-1 overflow-y-auto px-1 pb-2">
        {order.length === 0 && (
          <li className="px-3 py-2 text-xs text-ink-subtle">
            No files seeded from the fix plan.
          </li>
        )}
        {order.map((id) => {
          const f = files[id];
          if (!f) return null;
          const active = id === activeFileId;
          const pathParts = f.path.split("/");
          const filename = pathParts.pop();
          const parent = pathParts.join("/");
          return (
            <li key={id}>
              <div
                className={clsx(
                  "group flex items-center justify-between gap-1 rounded-md px-2 py-1.5 text-xs transition",
                  active
                    ? "bg-violet-500/15 text-ink"
                    : "text-ink-muted hover:bg-white/5 hover:text-ink",
                )}
              >
                <button
                  onClick={() => setActiveFile(id)}
                  className="flex min-w-0 flex-1 flex-col text-left"
                >
                  <span className="truncate font-mono">{filename}</span>
                  {parent && (
                    <span className="truncate text-[10px] text-ink-subtle">
                      {parent}
                    </span>
                  )}
                </button>
                <div className="flex items-center gap-1">
                  {f.has_draft && (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400"
                      title="unsaved edits"
                    />
                  )}
                  {f.is_ai_assisted && (
                    <span
                      className="text-[10px] text-violet-300"
                      title="ai-assisted"
                    >
                      ✦
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeFile(id);
                    }}
                    className="hidden text-ink-subtle hover:text-red-300 group-hover:inline"
                    title="remove from session"
                  >
                    ×
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-surface-border p-2">
        <Button
          size="sm"
          variant="secondary"
          className="w-full"
          onClick={() => setBrowserOpen(true)}
        >
          Open file…
        </Button>
      </div>

      {browserOpen && <TreeBrowserModal onClose={() => setBrowserOpen(false)} />}
    </aside>
  );
}
