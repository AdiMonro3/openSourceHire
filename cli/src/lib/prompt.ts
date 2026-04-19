import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(question);
    return answer.trim();
  } finally {
    rl.close();
  }
}

export async function promptMultiline(question: string): Promise<string> {
  process.stdout.write(question + "\n(end with a line containing only '.' — or Ctrl-D)\n");
  const rl = createInterface({ input, output });
  const lines: string[] = [];
  for await (const line of rl) {
    if (line === ".") break;
    lines.push(line);
  }
  rl.close();
  return lines.join("\n").trim();
}
