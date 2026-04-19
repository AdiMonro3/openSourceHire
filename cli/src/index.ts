#!/usr/bin/env node
import { Command } from "commander";

import { draftPr } from "./commands/draft-pr.js";
import { explain } from "./commands/explain.js";
import { login } from "./commands/login.js";
import { review } from "./commands/review.js";

const program = new Command();

program.name("osh").description("OpenSourceHire CLI companion").version("0.0.1");

program.command("login").description("Authenticate with OpenSourceHire").action(login);

program
  .command("explain")
  .argument("<issue-url>", "GitHub issue URL")
  .description("Plain-English summary + likely fix for an issue")
  .action(explain);

program.command("draft-pr").description("Draft a PR title, body, and commit message").action(draftPr);

program.command("review").description("Review staged diff for style and tests").action(review);

program.parseAsync(process.argv);
