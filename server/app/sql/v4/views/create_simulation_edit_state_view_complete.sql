-- View: view_simulation_edit_state
-- Encapsulates per-simulation state data (user-independent) used for permission checks.
-- Shared between the list and single-page queries for consistent can_edit logic.
-- This is a regular view (not materialized) so data is always fresh.

CREATE OR REPLACE VIEW view_simulation_edit_state AS
SELECT
    s.id AS simulation_id,
    -- Department IDs array (active only - for permission checks)
    (SELECT ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at)
     FROM simulation_departments_junction sd
     WHERE sd.simulation_id = s.id AND sd.active = true
    ) AS department_ids,
    -- Active cohort links (for can_delete)
    COUNT(DISTINCT CASE
        WHEN cs.active = true THEN cs.cohort_id
    END) AS active_cohort_count,
    -- Total cohort links (for can_delete)
    COUNT(cs.cohort_id) AS total_cohort_links,
    -- Distinct cohort count (for display)
    COUNT(DISTINCT cs.cohort_id) AS num_cohorts
FROM simulation_artifact s
LEFT JOIN cohort_simulations_junction cs ON cs.simulation_id = s.id
GROUP BY s.id;
