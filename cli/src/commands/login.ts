import kleur from "kleur";

import { api, CliApiError } from "../lib/api.js";
import { configPath, readConfig, writeConfig } from "../lib/config.js";
import { prompt } from "../lib/prompt.js";

type Me = { github_login: string; name: string | null };

export async function login(): Promise<void> {
  const cfg = readConfig();
  const tokenUrl = cfg.apiUrl.replace(/\/+$/, "").replace(
    /:\d+$/,
    (m) => (m === ":8000" ? ":3000" : m),
  );
  const profileUrl = `${tokenUrl}/dashboard/profile`;

  console.log(kleur.bold("osh login"));
  console.log(
    `\n1. Open ${kleur.cyan(profileUrl)} and click "Generate token".`,
  );
  console.log("2. Copy the token shown (starts with " + kleur.dim("osh_…") + ").\n");

  const token = await prompt("Paste token: ");
  if (!token) {
    console.error(kleur.red("No token entered."));
    process.exit(1);
  }

  writeConfig({ ...cfg, token });

  try {
    const me = await api<Me>("/users/me");
    console.log(
      kleur.green(`\n✓ Signed in as ${me.github_login}${me.name ? ` (${me.name})` : ""}`),
    );
    console.log(kleur.dim(`  Token stored in ${configPath()}`));
  } catch (e) {
    writeConfig({ ...cfg, token: undefined });
    if (e instanceof CliApiError && e.status === 401) {
      console.error(
        kleur.red("\n✗ Token rejected. Make sure you copied the whole value and that the backend is running."),
      );
    } else {
      console.error(kleur.red(`\n✗ Verification failed: ${(e as Error).message}`));
    }
    process.exit(1);
  }
}
