import { api } from "@/lib/api-client";

export type FixFileMeta = {
  id: number;
  path: string;
  size_bytes: number;
  is_ai_assisted: boolean;
  has_draft: boolean;
  updated_at: string | null;
};

export type FixSessionSummary = {
  id: number;
  issue_id: number;
  upstream_repo: string;
  default_branch: string;
  base_sha: string;
  fork_full_name: string | null;
  branch_name: string | null;
  state: "draft" | "submitting" | "pr_opened" | "failed" | "abandoned";
  pr_url: string | null;
  pr_number: number | null;
};

export type FixSessionResponse = FixSessionSummary & {
  files: FixFileMeta[];
  resumed?: boolean;
};

export type FixFileDetail = FixFileMeta & {
  original_text: string;
  draft_text: string | null;
  original_blob_sha: string;
};

export type AiEditResponse = {
  file_id: number;
  strategy: "full_replace" | "no_change_needed" | "range_replace";
  proposed_content: string;
  range: { start_line: number; end_line: number } | null;
  rationale: string;
  summary_of_change: string;
  confidence: "low" | "medium" | "high";
  unresolved: string[];
};

export type DiffResponse = {
  files: { path: string; diff: string; additions: number; deletions: number }[];
  total_additions: number;
  total_deletions: number;
};

export type TreeResponse = {
  paths: { path: string; type: string; size: number; sha: string }[];
};

export type SubmitResponse = {
  pr_url: string;
  pr_number: number;
  branch_name: string;
  fork_full_name: string;
  already_open?: boolean;
};

export type RebaseConflict = {
  path: string;
  kind:
    | "auto_updated"
    | "both_changed"
    | "upstream_deleted"
    | "became_binary";
  new_original_text?: string;
  new_original_blob_sha?: string;
};

export type RebaseResponse = {
  new_base_sha: string;
  default_branch: string;
  conflicts: RebaseConflict[];
};

export const fixApi = {
  createSession: (issueId: number) =>
    api<FixSessionResponse>(`/issues/${issueId}/fix/session`, { method: "POST", body: "{}" }),
  getSession: (sid: number) =>
    api<FixSessionResponse>(`/fix/${sid}`),
  getFile: (sid: number, fid: number) =>
    api<FixFileDetail>(`/fix/${sid}/files/${fid}`),
  saveFile: (sid: number, fid: number, draft_text: string) =>
    api<FixFileMeta>(`/fix/${sid}/files/${fid}`, {
      method: "PUT",
      body: JSON.stringify({ draft_text }),
    }),
  addFile: (sid: number, path: string) =>
    api<FixFileMeta>(`/fix/${sid}/files`, {
      method: "POST",
      body: JSON.stringify({ path }),
    }),
  deleteFile: (sid: number, fid: number) =>
    api<{ ok: true }>(`/fix/${sid}/files/${fid}`, { method: "DELETE" }),
  aiEdit: (sid: number, fid: number, prompt?: string, selection?: { start_line: number; end_line: number }) =>
    api<AiEditResponse>(`/fix/${sid}/files/${fid}/ai-edit`, {
      method: "POST",
      body: JSON.stringify({ prompt, selection }),
    }),
  diff: (sid: number) =>
    api<DiffResponse>(`/fix/${sid}/diff`),
  tree: (sid: number) =>
    api<TreeResponse>(`/fix/${sid}/tree`),
  submit: (sid: number, overrides?: { pr_title?: string; pr_body?: string }) =>
    api<SubmitResponse>(`/fix/${sid}/submit`, {
      method: "POST",
      body: JSON.stringify(overrides ?? {}),
    }),
  rebase: (sid: number) =>
    api<RebaseResponse>(`/fix/${sid}/rebase`, { method: "POST", body: "{}" }),
  abandon: (sid: number) =>
    api<{ ok: true }>(`/fix/${sid}/abandon`, { method: "POST", body: "{}" }),
};
