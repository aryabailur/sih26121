#!/usr/bin/env bash
# NWIS one-command local start (macOS / Linux).
#   ./start.sh            # install if needed, reseed the demo knowledge base, start both servers
#   ./start.sh --no-seed  # keep the current database
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "== NWIS backend =="
cd "$ROOT/backend"
[ -d .venv ] || python3 -m venv .venv
.venv/bin/python -m pip install -q -r requirements.txt
command -v tesseract >/dev/null 2>&1 || echo "Tesseract OCR not found - scanned reports will be flagged, not read. Install: brew install tesseract | apt install tesseract-ocr"
[ "${1:-}" = "--no-seed" ] || .venv/bin/python seed_data.py
.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000 &
BACK=$!

echo "== NWIS frontend =="
cd "$ROOT/frontend"
npm install --no-audit --no-fund  # always sync so older checkouts pick up new packages
npm run dev -- --port 3000 &
FRONT=$!

trap 'kill $BACK $FRONT 2>/dev/null' INT TERM EXIT
echo "NWIS: UI http://localhost:3000  ·  API docs http://127.0.0.1:8000/docs  (Ctrl+C to stop)"
wait
