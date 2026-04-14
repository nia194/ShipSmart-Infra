#!/usr/bin/env bash
# ShipSmart - Environment Variable Checker (post-split)
# Verifies that required .env files exist across sibling repos.
# Usage: bash scripts/check-env.sh

set -e
INFRA_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIBLINGS_ROOT="$(cd "$INFRA_ROOT/.." && pwd)"
ERRORS=0

check_var() {
  local file="$1"
  local var="$2"
  if ! grep -q "^${var}=.\+" "$file" 2>/dev/null; then
    echo "  x $var is missing or empty in $file"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ok $var"
  fi
}

echo "-- Checking ShipSmart-Web/.env.local --------------------"
WEB_ENV="$SIBLINGS_ROOT/ShipSmart-Web/.env.local"
if [ ! -f "$WEB_ENV" ]; then
  echo "  x Missing $WEB_ENV - copy from ShipSmart-Web/.env.example"
  ERRORS=$((ERRORS + 1))
else
  check_var "$WEB_ENV" "VITE_SUPABASE_URL"
  check_var "$WEB_ENV" "VITE_SUPABASE_ANON_KEY"
  check_var "$WEB_ENV" "VITE_JAVA_API_BASE_URL"
  check_var "$WEB_ENV" "VITE_PYTHON_API_BASE_URL"
fi

echo ""
echo "-- Checking ShipSmart-Orchestrator/.env -----------------"
JAVA_ENV="$SIBLINGS_ROOT/ShipSmart-Orchestrator/.env"
if [ ! -f "$JAVA_ENV" ]; then
  echo "  x Missing $JAVA_ENV - copy from ShipSmart-Orchestrator/.env.example"
  ERRORS=$((ERRORS + 1))
else
  check_var "$JAVA_ENV" "DATABASE_URL"
  check_var "$JAVA_ENV" "DATABASE_USERNAME"
  check_var "$JAVA_ENV" "DATABASE_PASSWORD"
  check_var "$JAVA_ENV" "SUPABASE_URL"
  check_var "$JAVA_ENV" "SUPABASE_SERVICE_ROLE_KEY"
  check_var "$JAVA_ENV" "SUPABASE_JWT_SECRET"
fi

echo ""
echo "-- Checking ShipSmart-API/.env --------------------------"
PYTHON_ENV="$SIBLINGS_ROOT/ShipSmart-API/.env"
if [ ! -f "$PYTHON_ENV" ]; then
  echo "  x Missing $PYTHON_ENV - copy from ShipSmart-API/.env.example"
  ERRORS=$((ERRORS + 1))
else
  check_var "$PYTHON_ENV" "INTERNAL_JAVA_API_URL"
  check_var "$PYTHON_ENV" "CORS_ALLOWED_ORIGINS"
  check_var "$PYTHON_ENV" "VECTOR_STORE_TYPE"
  check_var "$PYTHON_ENV" "LLM_PROVIDER_FALLBACK"
fi

echo ""
if [ $ERRORS -gt 0 ]; then
  echo "x $ERRORS issue(s) found. Fix them before starting services."
  exit 1
else
  echo "ok All environment variables are configured."
fi
