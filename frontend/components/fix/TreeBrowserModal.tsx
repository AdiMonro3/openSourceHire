"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { fixApi, type TreeResponse } from "@/lib/fix-api";
import { useFixStore } from "@/lib/fix-store";

type Props = {
  onClose: () => void;
};

export function TreeBrowserModal({ onClose }: Props) {
  const session = useFixStore((s) => s.session);
  const files = useFixStore((s) => s.files);
  const order = useFixStore((s) => s.fileOrder);
  const addFile = useFixStore((s) => s.addFile);

  const [tree, setTree] = useState<TreeResponse | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fixApi
      .tree(session.id)
      .then((t) => setTree(t))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [session]);

  const alreadyIn = useMemo(() => {
    const set = new Set<string>();
    for (const id of order) {
      const f = files[id];
      if (f) set.add(f.path);
    }
    return set;
  }, [files, order]);

  const filtered = useMemo(() => {
    if (!tree) return [];
    const q = query.trim().toLowerCase();
    const entries = tree.paths.filter((p) => p.size <= 500 * 1024);
    if (!q) return entries.slice(0, 200);
    return entries
      .filter((p) => p.path.toLowerCase().includes(q))
      .slice(0, 200);
  }, [tree, query]);

  async function openPath(path: string) {
    setAdding(path);
    setError(null);
    try {
      await addFile(path);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-6 pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-surface-border bg-surface-raised shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-surface-border px-4 py-3">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files by path…"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-subtle outline-none"
          />
        </div>

        {loading && (
          <div className="px-4 py-6 text-sm text-ink-subtle">Loading repo tree…</div>
        )}
        {error && (
          <div className="px-4 py-3 text-xs text-red-300">{error}</div>
        )}

        {!loading && tree && (
          <ul className="max-h-[50vh] overflow-y-auto">
            {filtered.length === 0 && (
              <li className="px-4 py-6 text-sm text-ink-subtle">
                No matches in {tree.paths.length} paths.
              </li>
            )}
            {filtered.map((p) => {
              const already = alreadyIn.has(p.path);
              return (
                <li key={p.path}>
                  <button
                    disabled={already || adding === p.path}
                    onClick={() => openPath(p.path)}
                    className={clsx(
                      "flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-xs transition",
                      already
                        ? "text-ink-subtle"
                        : "text-ink-muted hover:bg-white/5 hover:text-ink",
                      adding === p.path && "opacity-60",
                    )}
                  >
                    <span className="truncate font-mono">{p.path}</span>
                    <span className="shrink-0 text-ink-subtle">
                      {already
                        ? "open"
                        : adding === p.path
                          ? "adding…"
                          : `${Math.ceil(p.size / 1024)} KB`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t border-surface-border px-4 py-2 text-[10px] text-ink-subtle">
          Files &gt;500KB and binaries are hidden.
        </div>
      </div>
    </div>
  );
}
