#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ShipSmart — Local Development Startup Script (post-split)
# Usage: bash scripts/dev-start.sh [web|java|python|all]
#
# Assumes all 4 repos are cloned as siblings under the same parent directory:
#   parent/
#   ├── ShipSmart-Web/
#   ├── ShipSmart-Orchestrator/
#   ├── ShipSmart-API/
#   └── ShipSmart-Infra/   (you are here)
#
# Prerequisites:
#   - Node 22+ and pnpm 9+ installed
#   - Java 25 installed (or use SDKMAN: sdk install java 25-open)
#   - Python 3.13 installed
#   - uv v0.6.5+ installed (curl -LsSf https://astral.sh/uv/install.sh | sh)
#   - ShipSmart-Web/.env.local copied from .env.example and filled in
#   - ShipSmart-Orchestrator/.env copied from .env.example and filled in
#   - ShipSmart-API/.env copied from .env.example and filled in
# ─────────────────────────────────────────────────────────────────────────────

set -e

INFRA_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIBLINGS_ROOT="$(cd "$INFRA_ROOT/.." && pwd)"
WEB_DIR="$SIBLINGS_ROOT/ShipSmart-Web"
JAVA_DIR="$SIBLINGS_ROOT/ShipSmart-Orchestrator"
PYTHON_DIR="$SIBLINGS_ROOT/ShipSmart-API"
TARGET="${1:-all}"

check_env() {
  local dir="$1"
  local filename="$2"
  local file="$dir/$filename"
  if [ ! -f "$file" ]; then
    echo "⚠  Missing $file — copy from $dir/.env.example and fill in values"
    exit 1
  fi
}

check_dir() {
  local dir="$1"
  if [ ! -d "$dir" ]; then
    echo "⚠  Missing sibling repo at $dir — clone it first"
    exit 1
  fi
}

start_web() {
  check_dir "$WEB_DIR"
  echo "▶ Starting React frontend (port 5173)..."
  cd "$WEB_DIR"
  pnpm install
  pnpm dev &
}

start_java() {
  check_dir "$JAVA_DIR"
  check_env "$JAVA_DIR" ".env"
  echo "▶ Starting Spring Boot Java API (port 8080)..."
  cd "$JAVA_DIR"
  set -a; source .env; set +a
  ./gradlew bootRun &
}

start_python() {
  check_dir "$PYTHON_DIR"
  check_env "$PYTHON_DIR" ".env"
  echo "▶ Starting FastAPI Python API (port 8000)..."
  cd "$PYTHON_DIR"
  uv sync
  uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
}

case "$TARGET" in
  web)
    start_web
    ;;
  java)
    start_java
    ;;
  python)
    start_python
    ;;
  all)
    start_web
    start_java
    start_python
    echo ""
    echo "✓ All services starting:"
    echo "  Web     → http://localhost:5173"
    echo "  Java    → http://localhost:8080"
    echo "  Python  → http://localhost:8000"
    echo ""
    echo "  Java health   → http://localhost:8080/api/v1/health"
    echo "  Python health → http://localhost:8000/health"
    echo "  Python docs   → http://localhost:8000/docs"
    echo ""
    wait
    ;;
  *)
    echo "Usage: $0 [web|java|python|all]"
    exit 1
    ;;
esac
