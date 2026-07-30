-- Migration 0017 may already be journaled on development databases that ran
-- its earlier form before the Phase 8C schema-version stamp was appended.
-- Do not amend 0017: this separate, idempotent migration advances only the
-- readiness marker after the Phase 8C DDL is already present.
UPDATE schema_metadata
SET schema_version = 'phase-8c-payment-reconciliation-v1', applied_at = CURRENT_TIMESTAMP
WHERE id = 1;
