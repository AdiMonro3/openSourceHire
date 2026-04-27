import { create } from "zustand";
import {
  fixApi,
  type AiEditResponse,
  type FixFileDetail,
  type FixFileMeta,
  type FixSessionSummary,
} from "@/lib/fix-api";

type FileEntry = FixFileMeta & {
  loaded: boolean;
  original_text: string;
  draft_text: string;
};

type Proposal = AiEditResponse & { baseText: string };

type State = {
  issueId: number | null;
  session: FixSessionSummary | null;
  files: Record<number, FileEntry>;
  fileOrder: number[];
  activeFileId: number | null;
  pendingProposal: Proposal | null;
  proposalLoading: boolean;
  proposalError: string | null;
  savingFileIds: Set<number>;
  bootError: string | null;
  booted: boolean;
};

type Actions = {
  reset: () => void;
  boot: (issueId: number) => Promise<void>;
  loadFile: (fileId: number) => Promise<void>;
  setActiveFile: (fileId: number) => void;
  setDraft: (fileId: number, text: string) => void;
  saveNow: (fileId: number) => Promise<void>;
  addFile: (path: string) => Promise<FixFileMeta>;
  removeFile: (fileId: number) => Promise<void>;
  requestAiEdit: (prompt?: string, selection?: { start_line: number; end_line: number }) => Promise<void>;
  acceptProposal: () => void;
  rejectProposal: () => void;
  refreshSession: () => Promise<void>;
};

const initial: State = {
  issueId: null,
  session: null,
  files: {},
  fileOrder: [],
  activeFileId: null,
  pendingProposal: null,
  proposalLoading: false,
  proposalError: null,
  savingFileIds: new Set(),
  bootError: null,
  booted: false,
};

function mergeFileMeta(entry: FileEntry | undefined, meta: FixFileMeta): FileEntry {
  return {
    ...meta,
    loaded: entry?.loaded ?? false,
    original_text: entry?.original_text ?? "",
    draft_text: entry?.draft_text ?? "",
  };
}

function entryFromDetail(detail: FixFileDetail): FileEntry {
  return {
    id: detail.id,
    path: detail.path,
    size_bytes: detail.size_bytes,
    is_ai_assisted: detail.is_ai_assisted,
    has_draft: detail.has_draft,
    updated_at: detail.updated_at,
    loaded: true,
    original_text: detail.original_text,
    draft_text: detail.draft_text ?? detail.original_text,
  };
}

function applyStrategy(proposal: AiEditResponse, baseText: string): string | null {
  if (proposal.strategy === "no_change_needed") return null;
  if (proposal.strategy === "full_replace") return proposal.proposed_content;
  const range = proposal.range;
  if (!range) return proposal.proposed_content;
  const lines = baseText.split("\n");
  const start = Math.max(1, Math.min(range.start_line, lines.length + 1));
  const end = Math.max(start, Math.min(range.end_line, lines.length));
  const replacement = proposal.proposed_content.split("\n");
  const next = [...lines.slice(0, start - 1), ...replacement, ...lines.slice(end)];
  return next.join("\n");
}

export const useFixStore = create<State & Actions>((set, get) => {
  const debounceTimers = new Map<number, ReturnType<typeof setTimeout>>();

  function scheduleSave(fileId: number) {
    const existing = debounceTimers.get(fileId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      debounceTimers.delete(fileId);
      void get().saveNow(fileId);
    }, 1500);
    debounceTimers.set(fileId, t);
  }

  return {
    ...initial,

    reset: () => set({ ...initial, files: {}, savingFileIds: new Set() }),

    boot: async (issueId) => {
      set({ issueId, booted: false, bootError: null });
      try {
        const sess = await fixApi.createSession(issueId);
        const files: Record<number, FileEntry> = {};
        const order: number[] = [];
        for (const m of sess.files) {
          files[m.id] = mergeFileMeta(undefined, m);
          order.push(m.id);
        }
        set({
          session: {
            id: sess.id,
            issue_id: sess.issue_id,
            upstream_repo: sess.upstream_repo,
            default_branch: sess.default_branch,
            base_sha: sess.base_sha,
            fork_full_name: sess.fork_full_name,
            branch_name: sess.branch_name,
            state: sess.state,
            pr_url: sess.pr_url,
            pr_number: sess.pr_number,
          },
          files,
          fileOrder: order,
          activeFileId: order[0] ?? null,
          booted: true,
        });
        if (order[0]) await get().loadFile(order[0]);
      } catch (e) {
        set({ bootError: e instanceof Error ? e.message : String(e), booted: true });
      }
    },

    loadFile: async (fileId) => {
      const existing = get().files[fileId];
      if (existing?.loaded) return;
      const detail = await fixApi.getFile(get().session!.id, fileId);
      set((s) => ({
        files: { ...s.files, [fileId]: entryFromDetail(detail) },
      }));
    },

    setActiveFile: (fileId) => {
      set({ activeFileId: fileId, pendingProposal: null, proposalError: null });
      void get().loadFile(fileId);
    },

    setDraft: (fileId, text) => {
      set((s) => {
        const entry = s.files[fileId];
        if (!entry) return s;
        return {
          files: {
            ...s.files,
            [fileId]: {
              ...entry,
              draft_text: text,
              has_draft: text !== entry.original_text,
            },
          },
        };
      });
      scheduleSave(fileId);
    },

    saveNow: async (fileId) => {
      const entry = get().files[fileId];
      const session = get().session;
      if (!entry || !session) return;
      set((s) => ({ savingFileIds: new Set([...s.savingFileIds, fileId]) }));
      try {
        const meta = await fixApi.saveFile(session.id, fileId, entry.draft_text);
        set((s) => ({
          files: { ...s.files, [fileId]: { ...s.files[fileId], ...meta } },
        }));
      } finally {
        set((s) => {
          const next = new Set(s.savingFileIds);
          next.delete(fileId);
          return { savingFileIds: next };
        });
      }
    },

    addFile: async (path) => {
      const session = get().session!;
      const meta = await fixApi.addFile(session.id, path);
      set((s) => {
        const entry = mergeFileMeta(undefined, meta);
        const order = s.fileOrder.includes(meta.id)
          ? s.fileOrder
          : [...s.fileOrder, meta.id];
        return {
          files: { ...s.files, [meta.id]: entry },
          fileOrder: order,
          activeFileId: meta.id,
        };
      });
      await get().loadFile(meta.id);
      return meta;
    },

    removeFile: async (fileId) => {
      const session = get().session!;
      await fixApi.deleteFile(session.id, fileId);
      set((s) => {
        const { [fileId]: _omit, ...rest } = s.files;
        const order = s.fileOrder.filter((id) => id !== fileId);
        return {
          files: rest,
          fileOrder: order,
          activeFileId:
            s.activeFileId === fileId ? order[0] ?? null : s.activeFileId,
        };
      });
    },

    requestAiEdit: async (prompt, selection) => {
      const session = get().session!;
      const fileId = get().activeFileId;
      const entry = fileId != null ? get().files[fileId] : null;
      if (!session || fileId == null || !entry) return;
      set({ proposalLoading: true, proposalError: null, pendingProposal: null });
      try {
        const res = await fixApi.aiEdit(session.id, fileId, prompt, selection);
        set({
          pendingProposal: { ...res, baseText: entry.draft_text },
          proposalLoading: false,
        });
      } catch (e) {
        set({
          proposalError: e instanceof Error ? e.message : String(e),
          proposalLoading: false,
        });
      }
    },

    acceptProposal: () => {
      const proposal = get().pendingProposal;
      const fileId = get().activeFileId;
      if (!proposal || fileId == null) return;
      const next = applyStrategy(proposal, proposal.baseText);
      if (next !== null) {
        get().setDraft(fileId, next);
      }
      set({ pendingProposal: null, proposalError: null });
    },

    rejectProposal: () => set({ pendingProposal: null, proposalError: null }),

    refreshSession: async () => {
      const session = get().session;
      if (!session) return;
      const sess = await fixApi.getSession(session.id);
      set((s) => {
        const files = { ...s.files };
        const order: number[] = [];
        for (const m of sess.files) {
          files[m.id] = mergeFileMeta(files[m.id], m);
          order.push(m.id);
        }
        return {
          session: {
            id: sess.id,
            issue_id: sess.issue_id,
            upstream_repo: sess.upstream_repo,
            default_branch: sess.default_branch,
            base_sha: sess.base_sha,
            fork_full_name: sess.fork_full_name,
            branch_name: sess.branch_name,
            state: sess.state,
            pr_url: sess.pr_url,
            pr_number: sess.pr_number,
          },
          files,
          fileOrder: order,
        };
      });
    },
  };
});
