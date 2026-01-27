-- View: view_attempts
-- Wrapper for attempts_entry (simulation only).
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).
-- Filters active = true by default.

CREATE OR REPLACE VIEW view_attempts AS
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
FROM simulation_attempts_entry
WHERE active = true;
