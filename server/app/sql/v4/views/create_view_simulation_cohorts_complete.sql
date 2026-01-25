-- View: view_simulation_cohorts
-- Layer 2 Domain Aggregate View: Active cohorts linked to each simulation.
-- Uses cohort_simulations_junction filtered by active cohorts.
-- Write to _entry tables, read from this _view.

CREATE OR REPLACE VIEW view_simulation_cohorts AS
SELECT
    cs.simulation_id,
    ARRAY_AGG(cs.cohort_id) FILTER (WHERE cs.active = true) AS cohort_ids
FROM cohort_simulations_junction cs
WHERE EXISTS (
    -- Only include active cohorts
    SELECT 1
    FROM cohort_flags_junction cf
    JOIN flags_resource f ON cf.flag_id = f.id
    WHERE cf.cohort_id = cs.cohort_id
      AND f.name = 'cohort_active'
      AND cf.value = true
)
GROUP BY cs.simulation_id;
