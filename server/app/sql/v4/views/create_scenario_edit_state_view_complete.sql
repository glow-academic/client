-- View: view_scenario_edit_state
-- Encapsulates per-scenario state data (user-independent) used for permission checks.
-- Shared between the list and single-page queries for consistent can_edit logic.
-- This is a regular view (not materialized) so data is always fresh.

CREATE OR REPLACE VIEW view_scenario_edit_state AS
SELECT
    s.id AS scenario_id,
    -- Active usage: count of simulation links where scenario is active
    COUNT(DISTINCT CASE
        WHEN EXISTS (
            SELECT 1 FROM scenario_flags_junction sf
            JOIN flags_resource f ON sf.flag_id = f.id
            WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = TRUE
        ) THEN ss.simulation_id
    END) AS active_usage_count,
    -- Department IDs array
    (SELECT ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at)
     FROM scenario_departments_junction sd
     WHERE sd.scenario_id = s.id AND sd.active = true
    ) AS department_ids,
    -- Total simulation links (for can_delete)
    COUNT(DISTINCT ss.simulation_id) AS total_links
FROM scenario_artifact s
LEFT JOIN simulation_scenarios_junction ss ON ss.scenario_id = s.id
GROUP BY s.id;
