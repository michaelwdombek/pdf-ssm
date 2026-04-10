#!/usr/bin/env bash
set -euo pipefail

# SignDesk local development startup
# Runs both frontend (Vite) and backend (Fastify) in dev mode.
# Backend runs with DEV_MODE=true — no OIDC provider needed,
# "Sign In" will auto-login as a dev user.

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
  echo ""
  echo "Shutting down..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  echo "Done."
}
trap cleanup EXIT INT TERM

# --- Install deps if needed ---
if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "Installing frontend dependencies..."
  (cd "$ROOT_DIR" && npm install)
fi

if [ ! -d "$ROOT_DIR/server/node_modules" ]; then
  echo "Installing server dependencies..."
  (cd "$ROOT_DIR/server" && npm install)
fi

# --- Start backend ---
echo "Starting backend (DEV_MODE, port 3001)..."
(
  cd "$ROOT_DIR/server"
  export DEV_MODE=true
  export PORT=3001
  export HOST=127.0.0.1
  export STORAGE_ROOT="$ROOT_DIR/server/data"
  exec npm run dev 2>&1
) &
BACKEND_PID=$!

# Wait for backend to be ready
echo -n "Waiting for backend..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3001/api/health >/dev/null 2>&1; then
    echo " ready!"
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo " backend exited unexpectedly!"
    exit 1
  fi
  echo -n "."
  sleep 0.5
done

# --- Start frontend ---
echo ""
echo "Starting frontend (Vite dev server)..."
(
  cd "$ROOT_DIR"
  exec npm run dev 2>&1
) &
FRONTEND_PID=$!

echo ""
echo "============================================"
echo "  SignDesk dev environment running"
echo ""
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://127.0.0.1:3001 (API only)"
echo ""
echo "  Open http://localhost:5173 in your browser"
echo "  Click 'Sign In' to auto-login as Dev User"
echo ""
echo "  Press Ctrl+C to stop"
echo "============================================"
echo ""

# Wait for either to exit
wait -n "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
