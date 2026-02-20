-- Materialized View: invocation_drafts_mv
-- Per-artifact draft MV for benchmark bundle drafts with denormalized resource IDs.
-- Mirrors the resource arrays of invocation_mv.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'invocation_drafts_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS invocation_drafts_mv CASCADE;

CREATE MATERIALIZED VIEW invocation_drafts_mv AS
WITH draft_links AS (
    SELECT draft_id, 'departments'::text AS resource_type, departments_id AS resource_id FROM invocation_drafts_departments_connection WHERE active = true
    UNION ALL SELECT draft_id, 'descriptions'::text AS resource_type, descriptions_id AS resource_id FROM invocation_drafts_descriptions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'flags'::text AS resource_type, flags_id AS resource_id FROM invocation_drafts_flags_connection WHERE active = true
    UNION ALL SELECT draft_id, 'groups'::text AS resource_type, groups_id AS resource_id FROM invocation_drafts_groups_connection WHERE active = true
    UNION ALL SELECT draft_id, 'instructions'::text AS resource_type, instructions_id AS resource_id FROM invocation_drafts_instructions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'keys'::text AS resource_type, keys_id AS resource_id FROM invocation_drafts_keys_connection WHERE active = true
    UNION ALL SELECT draft_id, 'names'::text AS resource_type, names_id AS resource_id FROM invocation_drafts_names_connection WHERE active = true
    UNION ALL SELECT draft_id, 'prompts'::text AS resource_type, prompts_id AS resource_id FROM invocation_drafts_prompts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'reasoning_levels'::text AS resource_type, reasoning_levels_id AS resource_id FROM invocation_drafts_reasoning_levels_connection WHERE active = true
    UNION ALL SELECT draft_id, 'runs'::text AS resource_type, runs_id AS resource_id FROM invocation_drafts_runs_connection WHERE active = true
    UNION ALL SELECT draft_id, 'temperature_levels'::text AS resource_type, temperature_levels_id AS resource_id FROM invocation_drafts_temperature_levels_connection WHERE active = true
    UNION ALL SELECT draft_id, 'tools'::text AS resource_type, tools_id AS resource_id FROM invocation_drafts_tools_connection WHERE active = true
    UNION ALL SELECT draft_id, 'voices'::text AS resource_type, voices_id AS resource_id FROM invocation_drafts_voices_connection WHERE active = true
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
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'departments'), ARRAY[]::uuid[]) AS department_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'descriptions'), ARRAY[]::uuid[]) AS description_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'groups'), ARRAY[]::uuid[]) AS group_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'instructions'), ARRAY[]::uuid[]) AS instruction_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'keys'), ARRAY[]::uuid[]) AS key_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'), ARRAY[]::uuid[]) AS name_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'prompts'), ARRAY[]::uuid[]) AS prompt_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'reasoning_levels'), ARRAY[]::uuid[]) AS reasoning_level_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'runs'), ARRAY[]::uuid[]) AS run_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'temperature_levels'), ARRAY[]::uuid[]) AS temperature_level_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'tools'), ARRAY[]::uuid[]) AS tool_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'voices'), ARRAY[]::uuid[]) AS voice_ids
FROM invocation_drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active, d.group_id
WITH NO DATA;

CREATE UNIQUE INDEX invocation_drafts_mv_pk ON invocation_drafts_mv (draft_id);

REFRESH MATERIALIZED VIEW invocation_drafts_mv;
