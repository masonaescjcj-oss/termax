#!/usr/bin/env bash
# Prepares the repo for a Claude Code session: installs deps if missing.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 0

for pkg in backend mobile; do
  if [ -f "$pkg/package.json" ] && [ ! -d "$pkg/node_modules" ]; then
    echo "Installing $pkg dependencies..."
    (cd "$pkg" && npm install --no-audit --no-fund) || echo "warning: npm install failed in $pkg"
  fi
done

if [ ! -f backend/.env ] && [ -f backend/.env.example ]; then
  echo "note: backend/.env is missing — copy backend/.env.example and fill in values."
fi
