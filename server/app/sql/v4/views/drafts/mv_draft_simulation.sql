-- Materialized View: mv_draft_simulation
-- Per-artifact draft MV for simulation drafts with denormalized resource IDs.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_draft_simulation'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS mv_draft_simulation CASCADE;

CREATE MATERIALIZED VIEW mv_draft_simulation AS
WITH draft_links AS (
    SELECT draft_id, 'names'::resource_type AS resource_type, names_id::uuid AS resource_id FROM names_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'descriptions'::resource_type AS resource_type, descriptions_id::uuid AS resource_id FROM descriptions_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'flags'::resource_type AS resource_type, flags_id::uuid AS resource_id FROM flags_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'departments'::resource_type AS resource_type, departments_id::uuid AS resource_id FROM departments_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'scenarios'::resource_type AS resource_type, scenarios_id::uuid AS resource_id FROM scenarios_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'scenario_flags'::resource_type AS resource_type, scenario_flags_id::uuid AS resource_id FROM scenario_flags_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'scenario_positions'::resource_type AS resource_type, scenario_positions_id::uuid AS resource_id FROM scenario_positions_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'scenario_rubrics'::resource_type AS resource_type, scenario_rubrics_id::uuid AS resource_id FROM scenario_rubrics_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'scenario_time_limits'::resource_type AS resource_type, scenario_time_limits_id::uuid AS resource_id FROM scenario_time_limits_drafts_connection WHERE active = true
)
SELECT
    d.id AS draft_id,
    d.created_at,
    d.updated_at,
    d.version,
    d.generated,
    d.mcp,
    d.active,
    (SELECT ggc.groups_id FROM groups_groups_connection ggc WHERE ggc.group_id = d.group_id AND ggc.active = true LIMIT 1) AS group_id,
    COALESCE((SELECT ARRAY_AGG(re.instructions ORDER BY re.created_at ASC, re.id ASC) FROM regenerates_entry re WHERE re.draft_id = d.id AND re.active = true), ARRAY[]::text[]) AS regeneration_descriptions,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'::resource_type), ARRAY[]::uuid[]) AS name_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'descriptions'::resource_type), ARRAY[]::uuid[]) AS description_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'::resource_type), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'departments'::resource_type), ARRAY[]::uuid[]) AS department_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'scenarios'::resource_type), ARRAY[]::uuid[]) AS scenario_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'scenario_flags'::resource_type), ARRAY[]::uuid[]) AS scenario_flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'scenario_positions'::resource_type), ARRAY[]::uuid[]) AS scenario_position_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'scenario_rubrics'::resource_type), ARRAY[]::uuid[]) AS scenario_rubric_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'scenario_time_limits'::resource_type), ARRAY[]::uuid[]) AS scenario_time_limit_ids
FROM drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
WHERE d.artifact = 'simulation'::artifact_type
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active
WITH NO DATA;

CREATE UNIQUE INDEX mv_draft_simulation_pk ON mv_draft_simulation (draft_id);

REFRESH MATERIALIZED VIEW mv_draft_simulation;
