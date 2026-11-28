#!/usr/bin/env bash
# One-command local run: ./start.sh  (or: npm run local)
# Installs dependencies if needed, creates .env.local, then starts CoupleTab at http://localhost:3000
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install Node 20 or newer from https://nodejs.org (or: brew install node), then run ./start.sh again."
  exit 1
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "CoupleTab needs Node 20 or newer (you have $(node -v)). Update from https://nodejs.org or with: brew upgrade node"
  exit 1
fi

if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "Installing dependencies (first run takes a minute)..."
  npm install --no-audit --no-fund
fi

if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "Created .env.local. Add GEMINI_API_KEY there to turn on receipt scanning."
fi

PORT="${PORT:-3000}"
echo ""
echo "  CoupleTab is starting at http://localhost:$PORT"
echo "  Sign up at http://localhost:$PORT/signup  (accounts are stored in .data/ on this computer)"
echo "  Press Ctrl+C to stop."
echo ""
if [ "${OPEN_BROWSER:-1}" = "1" ] && command -v open >/dev/null 2>&1; then
  (sleep 4 && open "http://localhost:$PORT") >/dev/null 2>&1 &
fi
exec npx next dev -p "$PORT"
