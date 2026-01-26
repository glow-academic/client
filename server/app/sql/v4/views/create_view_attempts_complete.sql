-- View: view_attempts
-- Wrapper for attempts_entry (general + practice).
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).
-- Filters active = true by default.
-- Combines general_attempts_entry and practice_attempts_entry via UNION ALL.
-- Also includes 'attempt_type' column to distinguish general vs practice.

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
    'general'::text AS attempt_type
FROM general_attempts_entry
WHERE active = true
UNION ALL
SELECT
    id,
    created_at,
    updated_at,
    infinite_mode,
    archived,
    generated,
    mcp,
    active,
    'practice'::text AS attempt_type
FROM practice_attempts_entry
WHERE active = true;
