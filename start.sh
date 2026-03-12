#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

# ── colours ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Shopify Dev Tools — Dev Start    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

# ── check .env ─────────────────────────────────────────────────────────────
if [ ! -f "$BACKEND/.env" ]; then
  if [ -f "$ROOT/.env.example" ]; then
    cp "$ROOT/.env.example" "$BACKEND/.env"
    echo -e "${YELLOW}⚠  Created backend/.env from .env.example — fill in your API keys.${NC}"
  else
    echo -e "${RED}✗  No backend/.env found.${NC}"
    exit 1
  fi
fi

# ── Python: detect python or python3 ────────────────────────────────────────
PYTHON=""
for cmd in python python3; do
  if command -v "$cmd" &>/dev/null; then
    PYTHON="$cmd"
    break
  fi
done

if [ -z "$PYTHON" ]; then
  echo -e "${RED}✗  Python introuvable. Installe Python depuis python.org.${NC}"
  exit 1
fi

# ── Python venv ─────────────────────────────────────────────────────────────
if [ ! -d "$BACKEND/venv" ]; then
  echo -e "${YELLOW}→ Creating Python virtual environment...${NC}"
  "$PYTHON" -m venv "$BACKEND/venv"
fi

# ── pip path (Windows vs Unix) ───────────────────────────────────────────────
if [ -f "$BACKEND/venv/Scripts/pip" ]; then
  PIP="$BACKEND/venv/Scripts/pip"
  UVICORN="$BACKEND/venv/Scripts/uvicorn"
else
  PIP="$BACKEND/venv/bin/pip"
  UVICORN="$BACKEND/venv/bin/uvicorn"
fi

echo -e "${YELLOW}→ Installing Python dependencies...${NC}"
"$PIP" install -q -r "$BACKEND/requirements.txt"

# ── Node deps ───────────────────────────────────────────────────────────────
if [ ! -d "$FRONTEND/node_modules" ]; then
  echo -e "${YELLOW}→ Installing Node dependencies...${NC}"
  (cd "$FRONTEND" && npm install)
fi

# ── uploads dir ─────────────────────────────────────────────────────────────
mkdir -p "$BACKEND/uploads"

# ── start both servers ───────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}✓ Starting backend  → http://localhost:8000${NC}"
echo -e "${GREEN}✓ Starting frontend → http://localhost:3000${NC}"
echo ""
echo -e "  ${BLUE}/          ${NC}→ Landing page"
echo -e "  ${BLUE}/reviews   ${NC}→ Loox Review Generator"
echo -e "  ${BLUE}/theme     ${NC}→ Shopify Theme Customizer"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers.${NC}"
echo ""

(cd "$BACKEND" && "$UVICORN" app.main:app --host 0.0.0.0 --port 8000 --reload) &
BACKEND_PID=$!

trap "echo ''; echo -e '${YELLOW}Shutting down...${NC}'; kill $BACKEND_PID 2>/dev/null; exit 0" INT TERM

(cd "$FRONTEND" && npm run dev)

kill $BACKEND_PID 2>/dev/null
