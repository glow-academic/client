-- Materialized View: calls_mv
-- Lean call-level data for group detail pages.
--
-- Grain: One row per call (with run_id)
-- Filter: run_id IS NOT NULL
--
-- Purpose: Exposes tool_id (resource ID) — name resolved in hydration layer
-- Section: CALL (lean MV - used by group detail artifact)
--
-- Dependencies: calls_entry, call_uploads_entry, uploads_entry, uploads_uploads_connection, uploads_resource, tools_calls_connection

CREATE MATERIALIZED VIEW calls_mv AS
SELECT
    c.id AS call_id,
    c.run_id,
    c.created_at AS call_created_at,
    ur.id AS uploads_id,
    ue.file_path,
    ue.mime_type,
    tcc.tools_id AS tool_id
FROM calls_entry c
LEFT JOIN call_uploads_entry cue ON cue.call_id = c.id AND cue.active = true
LEFT JOIN uploads_entry ue ON ue.id = cue.upload_id AND ue.active = true
LEFT JOIN uploads_uploads_connection uuc ON uuc.upload_id = ue.id AND uuc.active = true
LEFT JOIN uploads_resource ur ON ur.id = uuc.uploads_id AND ur.active = true
LEFT JOIN tools_calls_connection tcc ON tcc.call_id = c.id
WHERE c.run_id IS NOT NULL
WITH NO DATA;
