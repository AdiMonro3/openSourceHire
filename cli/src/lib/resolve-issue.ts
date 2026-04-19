import { api, CliApiError } from "./api.js";

export type IssueLookup = {
  id: number;
  number: number;
  title: string;
  url: string;
};

const DASHBOARD_PATH = /\/dashboard\/issues\/(\d+)\b/;
const GITHUB_ISSUE = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+/i;

/**
 * Resolve either a GitHub issue URL or our own dashboard URL (which carries
 * the local row id in the path) to an IssueLookup. Users tend to paste
 * whichever URL they're currently looking at, so we accept both.
 */
export async function resolveIssue(input: string): Promise<IssueLookup> {
  const trimmed = input.trim();

  const dashMatch = trimmed.match(DASHBOARD_PATH);
  if (dashMatch) {
    const id = Number(dashMatch[1]);
    try {
      return await api<IssueLookup>(`/issues/${id}`);
    } catch (e) {
      if (e instanceof CliApiError && e.status === 404) {
        throw new CliApiError(404, `Issue ${id} not found.`);
      }
      throw e;
    }
  }

  if (GITHUB_ISSUE.test(trimmed)) {
    try {
      return await api<IssueLookup>(
        `/issues/by-url?url=${encodeURIComponent(trimmed)}`,
      );
    } catch (e) {
      if (e instanceof CliApiError && e.status === 404) {
        throw new CliApiError(
          404,
          "Issue not in index. Open it once in the web app, then retry.",
        );
      }
      throw e;
    }
  }

  throw new CliApiError(
    400,
    "Expected a GitHub issue URL or an osh dashboard issue URL.",
  );
}
