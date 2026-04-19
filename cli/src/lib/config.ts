import { mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type Config = {
  apiUrl: string;
  token?: string;
};

const CONFIG_PATH = join(homedir(), ".osh", "config.json");
const DEFAULT_API_URL =
  process.env.OSH_API_URL ?? "http://localhost:8000";

export function readConfig(): Config {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<Config>;
    return {
      apiUrl: parsed.apiUrl ?? DEFAULT_API_URL,
      token: parsed.token,
    };
  } catch {
    return { apiUrl: DEFAULT_API_URL };
  }
}

export function writeConfig(cfg: Config): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf8");
  try {
    chmodSync(CONFIG_PATH, 0o600);
  } catch {
    /* Windows / non-POSIX FS — best-effort only */
  }
}

export function configPath(): string {
  return CONFIG_PATH;
}
