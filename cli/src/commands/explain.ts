import kleur from "kleur";

import { api, CliApiError } from "../lib/api.js";
import { resolveIssue } from "../lib/resolve-issue.js";

type Understanding = {
  plain_summary: string;
  approach: string[];
  likely_files: string[];
  gotchas: string[];
  clarifying_questions: string[];
  difficulty: "easy" | "medium" | "hard";
};

const DIFFICULTY_COLOR: Record<Understanding["difficulty"], (s: string) => string> = {
  easy: kleur.green,
  medium: kleur.yellow,
  hard: kleur.red,
};

export async function explain(issueUrl: string): Promise<void> {
  let lookup;
  try {
    lookup = await resolveIssue(issueUrl);
  } catch (e) {
    if (e instanceof CliApiError) {
      console.error(kleur.red(e.message));
      process.exit(1);
    }
    throw e;
  }

  console.log(kleur.bold(`#${lookup.number}  ${lookup.title}`));
  console.log(kleur.dim(lookup.url));
  process.stdout.write(kleur.dim("\nDrafting plan…"));

  let u: Understanding;
  try {
    u = await api<Understanding>(`/issues/${lookup.id}/understand`);
  } finally {
    process.stdout.write("\r\x1b[K");
  }

  console.log(
    `\n${DIFFICULTY_COLOR[u.difficulty](`[${u.difficulty}]`)}  ${u.plain_summary}\n`,
  );

  if (u.approach.length) {
    console.log(kleur.bold("Approach"));
    u.approach.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
    console.log();
  }
  if (u.likely_files.length) {
    console.log(kleur.bold("Likely files"));
    u.likely_files.forEach((f) => console.log(`  ${kleur.cyan(f)}`));
    console.log();
  }
  if (u.gotchas.length) {
    console.log(kleur.bold("Gotchas"));
    u.gotchas.forEach((g) => console.log(`  ${kleur.yellow("!")} ${g}`));
    console.log();
  }
  if (u.clarifying_questions.length) {
    console.log(kleur.bold("Ask the maintainer"));
    u.clarifying_questions.forEach((q) =>
      console.log(`  ${kleur.magenta("?")} ${q}`),
    );
    console.log();
  }
}
