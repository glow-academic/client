-- Materialized View: attempt_analysis_mv
-- Grain: One row per analysis entry per grade
--
-- Purpose: Flat denormalized analysis rows for simulation grades,
-- replacing the analyses_agg composite array in attempt_chat_mv.
--
-- Dependencies: attempt_analysis_entry

CREATE MATERIALIZED VIEW attempt_analysis_mv AS
SELECT
    ae.id AS analysis_id,
    ae.grade_id,
    ae.content,
    ae.created_at
FROM attempt_analysis_entry ae
WITH NO DATA;
