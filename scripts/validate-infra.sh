#!/usr/bin/env bash
# ShipSmart-Infra — schema + edge-function invariant validator.
#
# Infra has no application code to unit-test, but it IS the source of truth for
# the database contract the other repos consume. This script is the repo's test:
# it greps the migrations + edge functions for the invariants that, if they
# drift, silently break a downstream service — and exits non-zero on any failure
# so it can gate a commit or CI step.
#
#   bash scripts/validate-infra.sh
#
# Checks:
#   1. The hybrid-RAG lexical function match_rag_chunks_lexical(...) exists and
#      RETURNS TABLE (id, source, chunk_index, text, score) — the exact shape
#      ShipSmart-API's pgvector_store.search_lexical() unpacks and ShipSmart-Test's
#      contract test asserts.
#   2. Every supabase/functions/*/index.ts registers a Deno.serve handler.
#   3. Every migration filename is Flyway/Supabase-orderable (14-digit timestamp).
#   4. The AI-event audit log (ai_audit_log) is append-only (WORM trigger) with a
#      pseudonymized identity column — never raw identity, never mutable.

set -uo pipefail
INFRA_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS="$INFRA_ROOT/supabase/migrations"
FUNCTIONS="$INFRA_ROOT/supabase/functions"
ERRORS=0

pass() { echo "  ok $1"; }
fail() { echo "  x  $1"; ERRORS=$((ERRORS + 1)); }

echo "== 1. RAG lexical function contract =================================="
LEX_FILE="$(grep -rl "match_rag_chunks_lexical(" "$MIGRATIONS" 2>/dev/null | head -1)"
if [ -z "$LEX_FILE" ]; then
  fail "match_rag_chunks_lexical(...) not defined in any migration"
else
  pass "defined in $(basename "$LEX_FILE")"
  # Columns declared between RETURNS TABLE and the LANGUAGE clause (the body's
  # SELECT comes later, so this only inspects the declared return shape).
  RETURNS_BLOCK="$(sed -n '/RETURNS TABLE/,/LANGUAGE/p' "$LEX_FILE")"
  for col in id source chunk_index text score; do
    if echo "$RETURNS_BLOCK" | grep -qE "\b${col}\b"; then
      pass "RETURNS TABLE includes '${col}'"
    else
      fail "RETURNS TABLE is missing '${col}' (breaks ShipSmart-API search_lexical)"
    fi
  done
fi

echo "== 2. Edge functions expose a Deno.serve handler ===================="
shopt -s nullglob
fn_count=0
for fn in "$FUNCTIONS"/*/index.ts; do
  fn_count=$((fn_count + 1))
  name="$(basename "$(dirname "$fn")")"
  if grep -q "Deno.serve" "$fn"; then
    pass "$name"
  else
    fail "$name/index.ts has no Deno.serve handler"
  fi
done
[ "$fn_count" -eq 0 ] && fail "no edge functions found under supabase/functions/"

echo "== 3. Migration filenames are timestamp-ordered ====================="
mig_count=0
for mig in "$MIGRATIONS"/*.sql; do
  mig_count=$((mig_count + 1))
  base="$(basename "$mig")"
  if [[ "$base" =~ ^[0-9]{14}_.*\.sql$ ]]; then
    pass "$base"
  else
    fail "$base does not match <14-digit-timestamp>_<name>.sql"
  fi
done
[ "$mig_count" -eq 0 ] && fail "no migrations found under supabase/migrations/"

echo "== 4. AI-event audit log is append-only (WORM) ======================"
AUDIT_FILE="$(grep -rl "CREATE TABLE IF NOT EXISTS public.ai_audit_log" "$MIGRATIONS" 2>/dev/null | head -1)"
if [ -z "$AUDIT_FILE" ]; then
  fail "ai_audit_log table not defined in any migration"
else
  pass "defined in $(basename "$AUDIT_FILE")"
  if grep -q "session_id_hash" "$AUDIT_FILE"; then
    pass "identity is pseudonymized (session_id_hash)"
  else
    fail "ai_audit_log has no session_id_hash (must not store raw identity)"
  fi
  if grep -qE "append-only" "$AUDIT_FILE"; then
    pass "append-only WORM guard present"
  else
    fail "ai_audit_log has no append-only (WORM) guard"
  fi
fi

echo "====================================================================="
if [ "$ERRORS" -eq 0 ]; then
  echo "OK — infra invariants hold ($fn_count edge functions, $mig_count migrations)."
  exit 0
fi
echo "FAILED — $ERRORS invariant violation(s). Fix before deploying schema/functions."
exit 1
