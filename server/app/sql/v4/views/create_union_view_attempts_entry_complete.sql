-- Union View: attempts_entry
-- Combines general_attempts_entry + practice_attempts_entry
-- into a single view for queries that need full attempt history (including inactive).
--
-- Note: The 'attempt_type' column indicates the source table ('general', 'practice').
-- Unlike view_attempt_base_complete, this view does NOT filter by active and does NOT include connections.
-- Use this when you need the raw entry data without joins.
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
    'general'::text AS attempt_type
FROM general_attempts_entry

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
FROM practice_attempts_entry;
