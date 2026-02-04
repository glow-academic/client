-- View: attempts_entry
-- Unified simulation attempts entry (single source of truth).
-- Includes inactive rows and preserves the historical schema shape.
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW attempts_entry AS
SELECT
    id,
    created_at,
    updated_at,
    infinite_mode,
    archived,
    generated,
    mcp,
    active,
    CASE
        WHEN practice IS TRUE THEN 'practice'::text
        ELSE 'general'::text
    END AS attempt_type
FROM simulation_attempts_entry;
