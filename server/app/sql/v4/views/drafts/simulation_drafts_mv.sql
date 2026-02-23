-- Materialized View: simulation_drafts_mv
-- Per-artifact draft MV for simulation drafts with denormalized resource IDs.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'simulation_drafts_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS simulation_drafts_mv CASCADE;

CREATE MATERIALIZED VIEW simulation_drafts_mv AS
WITH draft_links AS (
    SELECT draft_id, 'departments'::text AS resource_type, departments_id AS resource_id FROM simulation_drafts_departments_connection WHERE active = true
    UNION ALL SELECT draft_id, 'descriptions'::text AS resource_type, descriptions_id AS resource_id FROM simulation_drafts_descriptions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'flags'::text AS resource_type, flags_id AS resource_id FROM simulation_drafts_flags_connection WHERE active = true
    UNION ALL SELECT draft_id, 'names'::text AS resource_type, names_id AS resource_id FROM simulation_drafts_names_connection WHERE active = true
    UNION ALL SELECT draft_id, 'scenario_flags'::text AS resource_type, scenario_flags_id AS resource_id FROM simulation_drafts_scenario_flags_connection WHERE active = true
    UNION ALL SELECT draft_id, 'scenario_positions'::text AS resource_type, scenario_positions_id AS resource_id FROM simulation_drafts_scenario_positions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'scenario_rubrics'::text AS resource_type, scenario_rubrics_id AS resource_id FROM simulation_drafts_scenario_rubrics_connection WHERE active = true
    UNION ALL SELECT draft_id, 'scenario_time_limits'::text AS resource_type, scenario_time_limits_id AS resource_id FROM simulation_drafts_scenario_time_limits_connection WHERE active = true
    UNION ALL SELECT draft_id, 'scenarios'::text AS resource_type, scenarios_id AS resource_id FROM simulation_drafts_scenarios_connection WHERE active = true
    UNION ALL SELECT draft_id, 'simulations'::text AS resource_type, simulations_id AS resource_id FROM simulation_drafts_simulations_connection WHERE active = true
)
SELECT
    d.id AS draft_id,
    d.created_at,
    d.updated_at,
    d.version,
    d.generated,
    d.mcp,
    d.active,
    d.group_id,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'departments'), ARRAY[]::uuid[]) AS department_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'descriptions'), ARRAY[]::uuid[]) AS description_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'), ARRAY[]::uuid[]) AS name_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'scenario_flags'), ARRAY[]::uuid[]) AS scenario_flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'scenario_positions'), ARRAY[]::uuid[]) AS scenario_position_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'scenario_rubrics'), ARRAY[]::uuid[]) AS scenario_rubric_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'scenario_time_limits'), ARRAY[]::uuid[]) AS scenario_time_limit_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'scenarios'), ARRAY[]::uuid[]) AS scenario_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'simulations'), ARRAY[]::uuid[]) AS simulation_ids
FROM simulation_drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active, d.group_id
WITH NO DATA;

CREATE UNIQUE INDEX simulation_drafts_mv_pk ON simulation_drafts_mv (draft_id);

REFRESH MATERIALIZED VIEW simulation_drafts_mv;
