-- View: view_cohort_edit_state
-- Encapsulates per-cohort state data (user-independent) used for permission checks.
-- Shared between the list and single-page queries for consistent can_edit logic.
-- This is a regular view (not materialized) so data is always fresh.

CREATE OR REPLACE VIEW view_cohort_edit_state AS
SELECT
    c.id AS cohort_id,
    -- Department IDs array (active only - for permission checks)
    (SELECT ARRAY_AGG(cd.department_id::text ORDER BY cd.created_at)
     FROM cohort_departments_junction cd
     WHERE cd.cohort_id = c.id AND cd.active = true
    ) AS department_ids,
    -- Usage count (attempts linked through profiles in this cohort)
    COALESCE(
        (SELECT COUNT(DISTINCT sa.id)
         FROM profile_cohorts_junction cp
         JOIN profile_attempts_junction paj ON paj.profile_id = cp.profile_id
         JOIN attempts_entry sa ON sa.id = paj.attempt_id
         WHERE cp.cohort_id = c.id AND cp.active = true
        ), 0
    ) AS usage_count
FROM cohort_artifact c;
