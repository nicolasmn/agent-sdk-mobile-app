#!/usr/bin/env bash
#
# Installs git hooks into .git/hooks/. Called by `bun install` via `prepare` script.

set -euo pipefail

repo_root=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
if [ -z "$repo_root" ]; then
  echo "prepare: not a git repo, skipping hook install"
  exit 0
fi

hooks_dir="$repo_root/.git/hooks"
mkdir -p "$hooks_dir"

cp "$repo_root/scripts/pre-commit" "$hooks_dir/pre-commit"
chmod +x "$hooks_dir/pre-commit"

echo "prepare: installed pre-commit hook"
