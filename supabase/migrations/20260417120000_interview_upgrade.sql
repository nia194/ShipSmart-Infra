-- ShipSmart Interview Upgrade (2026-04-17)
-- Adds optimistic-locking + soft-delete columns to existing tables,
-- and introduces idempotency_keys and audit_log tables used by the
-- Java Orchestrator. Supabase remains the schema owner; Orchestrator's
-- Flyway runs in VALIDATE mode and mirrors this file 1:1 as V2.

-- ── Optimistic locking + soft delete on shipment_requests ───────────────────
ALTER TABLE public.shipment_requests
  ADD COLUMN IF NOT EXISTS version    BIGINT      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status     TEXT        NOT NULL DEFAULT 'DRAFT';

CREATE INDEX IF NOT EXISTS shipment_requests_status_idx
  ON public.shipment_requests (status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS shipment_requests_user_created_idx
  ON public.shipment_requests (user_id, created_at DESC) WHERE deleted_at IS NULL;

-- ── Optimistic locking + soft delete on saved_options ──────────────────────
ALTER TABLE public.saved_options
  ADD COLUMN IF NOT EXISTS version    BIGINT      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ── Idempotency keys (POST /shipments, POST /bookings/redirect) ────────────
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key              TEXT        PRIMARY KEY,
  user_id          UUID        NOT NULL,
  method           TEXT        NOT NULL,
  path             TEXT        NOT NULL,
  request_hash     TEXT        NOT NULL,
  response_status  INT         NOT NULL,
  response_body    JSONB       NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idempotency_keys_expires_idx
  ON public.idempotency_keys (expires_at);

-- RLS: only service role (Orchestrator) reads/writes this table.
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- ── Lightweight audit log (append-only) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id           BIGSERIAL   PRIMARY KEY,
  at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id      UUID,
  request_id   TEXT,
  action       TEXT        NOT NULL,
  entity       TEXT        NOT NULL,
  entity_id    UUID,
  diff         JSONB
);

CREATE INDEX IF NOT EXISTS audit_log_entity_idx
  ON public.audit_log (entity, entity_id);

CREATE INDEX IF NOT EXISTS audit_log_user_at_idx
  ON public.audit_log (user_id, at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
