-- View: view_persona_edit_state
-- Encapsulates per-persona state data (user-independent) used for permission checks.
-- Shared between the list and single-page queries for consistent can_edit logic.
-- This is a regular view (not materialized) so data is always fresh.

CREATE OR REPLACE VIEW view_persona_edit_state AS
SELECT
    p.id AS persona_id,
    -- Active usage: count of active scenario links
    COUNT(DISTINCT CASE
        WHEN sp.active = true THEN sp.scenario_id
    END) AS active_scenario_count,
    -- Department IDs array (active only - for permission checks)
    (SELECT ARRAY_AGG(pd.department_id::text ORDER BY pd.created_at)
     FROM persona_departments_junction pd
     WHERE pd.persona_id = p.id AND pd.active = true
    ) AS department_ids,
    -- Total scenario links (for can_delete)
    COUNT(DISTINCT sp.scenario_id) AS total_scenario_links
FROM persona_artifact p
LEFT JOIN persona_personas_junction ppj ON ppj.persona_id = p.id
LEFT JOIN personas_resource pr ON pr.id = ppj.personas_id
LEFT JOIN scenario_personas_junction sp ON sp.persona_id = pr.id
GROUP BY p.id;
