const MAP: Record<string, string> = {
  py: "python",
  pyi: "python",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  scala: "scala",
  rb: "ruby",
  php: "php",
  c: "c",
  h: "c",
  cc: "cpp",
  cpp: "cpp",
  hpp: "cpp",
  cs: "csharp",
  swift: "swift",
  m: "objective-c",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  sql: "sql",
  yaml: "yaml",
  yml: "yaml",
  toml: "ini",
  json: "json",
  md: "markdown",
  rst: "markdown",
  graphql: "graphql",
};

export function monacoLanguageForPath(path: string): string {
  const name = path.split("/").pop() ?? "";
  if (name === "Dockerfile") return "dockerfile";
  if (name === "Makefile") return "makefile";
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  return MAP[ext] ?? "plaintext";
}
