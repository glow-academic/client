-- View: view_cohort_edit_state
-- Encapsulates per-cohort state data (user-independent) used for permission checks.
-- Shared between the list and single-page queries for consistent can_edit logic.
-- This is a regular view (not materialized) so data is always fresh.
--
-- Uses the new entry→resource connection tables for usage count.

CREATE OR REPLACE VIEW view_cohort_edit_state AS
SELECT
    c.id AS cohort_id,
    -- Department IDs array (active only - for permission checks)
    (SELECT ARRAY_AGG(cd.department_id::text ORDER BY cd.created_at)
     FROM cohort_departments_junction cd
     WHERE cd.cohort_id = c.id AND cd.active = true
    ) AS department_ids,
    -- Usage count (general attempts linked through this cohort)
    -- Only general attempts have cohort connections
    COALESCE(
        (SELECT COUNT(DISTINCT gacc.attempt_id)
         FROM cohort_cohorts_junction ccj
         JOIN general_attempts_cohorts_connection gacc ON gacc.cohorts_id = ccj.cohorts_id
         WHERE ccj.cohort_id = c.id AND gacc.active = true
        ), 0
    ) AS usage_count
FROM cohort_artifact c;
