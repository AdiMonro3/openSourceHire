import kleur from "kleur";

import { api, CliApiError } from "../lib/api.js";
import { prompt, promptMultiline } from "../lib/prompt.js";
import { resolveIssue } from "../lib/resolve-issue.js";

type CoachOutput = {
  commit_title: string;
  commit_body: string;
  pr_title: string;
  pr_body: string;
  checklist: string[];
  questions_for_contributor: string[];
};

export async function draftPr(): Promise<void> {
  const issueUrl = await prompt("Issue URL: ");
  if (!issueUrl) {
    console.error(kleur.red("Issue URL is required."));
    process.exit(1);
  }

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

  console.log(kleur.dim(`\nIssue: #${lookup.number} ${lookup.title}`));

  const draft = await promptMultiline(
    "\nDescribe what you changed (plain English):",
  );
  if (!draft) {
    console.error(kleur.red("Draft is empty."));
    process.exit(1);
  }

  process.stdout.write(kleur.dim("\nCoaching…"));
  let result: CoachOutput;
  try {
    result = await api<CoachOutput>(`/issues/${lookup.id}/pr-coach`, {
      method: "POST",
      body: JSON.stringify({ draft }),
    });
  } finally {
    process.stdout.write("\r\x1b[K");
  }

  console.log(kleur.bold("\nCommit title"));
  console.log(`  ${result.commit_title}`);
  if (result.commit_body) {
    console.log(kleur.bold("\nCommit body"));
    console.log(indent(result.commit_body, "  "));
  }
  console.log(kleur.bold("\nPR title"));
  console.log(`  ${result.pr_title}`);
  console.log(kleur.bold("\nPR body"));
  console.log(indent(result.pr_body, "  "));

  if (result.checklist.length) {
    console.log(kleur.bold("\nBefore you open the PR"));
    result.checklist.forEach((c) => console.log(`  ${kleur.cyan("□")} ${c}`));
  }
  if (result.questions_for_contributor.length) {
    console.log(kleur.bold("\nOpen questions"));
    result.questions_for_contributor.forEach((q) =>
      console.log(`  ${kleur.magenta("?")} ${q}`),
    );
  }
  console.log();
}

function indent(text: string, pad: string): string {
  return text
    .split("\n")
    .map((l) => pad + l)
    .join("\n");
}
