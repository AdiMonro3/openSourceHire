#!/usr/bin/env bash
# Build the openSource-Hire study guide PDF.
#
#   1. Render every .mmd Mermaid source under docs/study-plan/ to a PNG.
#   2. Run pandoc to convert docs/study-plan.md → docs/study-plan.pdf
#      using tectonic (a self-contained xelatex implementation, no MacTeX
#      required).
#
# One-time setup (macOS):
#   brew install pandoc tectonic
#   pnpm setup && exec zsh
#   pnpm add -g @mermaid-js/mermaid-cli
#   npx puppeteer browsers install chrome-headless-shell
#
# Then re-run this script any time the .md or .mmd sources change.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLAN_DIR="$REPO_ROOT/docs/study-plan"
SOURCE_MD="$REPO_ROOT/docs/study-plan.md"
OUT_PDF="$REPO_ROOT/docs/study-plan.pdf"
PUP_CONFIG="$SCRIPT_DIR/puppeteer-config.json"

# Make sure pnpm-managed CLIs (mmdc) are on PATH even when invoked from
# a non-interactive shell.
export PNPM_HOME="${PNPM_HOME:-$HOME/Library/pnpm}"
export PATH="$PNPM_HOME:$PATH"

command -v pandoc >/dev/null   || { echo "✗ pandoc not on PATH — run: brew install pandoc"; exit 1; }
command -v tectonic >/dev/null || { echo "✗ tectonic not on PATH — run: brew install tectonic"; exit 1; }
command -v mmdc >/dev/null     || { echo "✗ mmdc not on PATH — run: pnpm add -g @mermaid-js/mermaid-cli"; exit 1; }

echo "→ Rendering Mermaid sources in $PLAN_DIR"
shopt -s nullglob
for src in "$PLAN_DIR"/*.mmd; do
  out="${src%.mmd}.png"
  if [[ -f "$PUP_CONFIG" ]]; then
    mmdc -p "$PUP_CONFIG" -i "$src" -o "$out" -b transparent -t dark -w 1600 >/dev/null
  else
    mmdc                  -i "$src" -o "$out" -b transparent -t dark -w 1600 >/dev/null
  fi
  echo "  ✓ $(basename "$out")"
done

echo "→ Building PDF: $OUT_PDF"
cd "$REPO_ROOT/docs"
pandoc "study-plan.md" \
  -o "study-plan.pdf" \
  --pdf-engine=tectonic \
  --toc --toc-depth=3 \
  --number-sections \
  -V geometry:margin=1in \
  -V mainfont="Helvetica" \
  -V monofont="Menlo" \
  -V colorlinks=true \
  -V linkcolor=violet \
  --highlight-style=breezedark

echo "✓ Done. Open: $OUT_PDF"
