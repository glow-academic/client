-- Materialized View: mv_draft_agent
-- Per-artifact draft MV for agent drafts with denormalized resource IDs.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_draft_agent'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS mv_draft_agent CASCADE;

CREATE MATERIALIZED VIEW mv_draft_agent AS
WITH draft_links AS (
    SELECT draft_id, 'agents'::text AS resource_type, agents_id AS resource_id FROM agent_drafts_agents_connection WHERE active = true
    UNION ALL SELECT draft_id, 'departments'::text AS resource_type, departments_id AS resource_id FROM agent_drafts_departments_connection WHERE active = true
    UNION ALL SELECT draft_id, 'descriptions'::text AS resource_type, descriptions_id AS resource_id FROM agent_drafts_descriptions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'flags'::text AS resource_type, flags_id AS resource_id FROM agent_drafts_flags_connection WHERE active = true
    UNION ALL SELECT draft_id, 'instructions'::text AS resource_type, instructions_id AS resource_id FROM agent_drafts_instructions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'models'::text AS resource_type, models_id AS resource_id FROM agent_drafts_models_connection WHERE active = true
    UNION ALL SELECT draft_id, 'names'::text AS resource_type, names_id AS resource_id FROM agent_drafts_names_connection WHERE active = true
    UNION ALL SELECT draft_id, 'prompts'::text AS resource_type, prompts_id AS resource_id FROM agent_drafts_prompts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'reasoning_levels'::text AS resource_type, reasoning_levels_id AS resource_id FROM agent_drafts_reasoning_levels_connection WHERE active = true
    UNION ALL SELECT draft_id, 'temperature_levels'::text AS resource_type, temperature_levels_id AS resource_id FROM agent_drafts_temperature_levels_connection WHERE active = true
    UNION ALL SELECT draft_id, 'tools'::text AS resource_type, tools_id AS resource_id FROM agent_drafts_tools_connection WHERE active = true
    UNION ALL SELECT draft_id, 'voices'::text AS resource_type, voices_id AS resource_id FROM agent_drafts_voices_connection WHERE active = true
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
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'agents'), ARRAY[]::uuid[]) AS agent_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'departments'), ARRAY[]::uuid[]) AS department_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'descriptions'), ARRAY[]::uuid[]) AS description_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'instructions'), ARRAY[]::uuid[]) AS instruction_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'models'), ARRAY[]::uuid[]) AS model_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'), ARRAY[]::uuid[]) AS name_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'prompts'), ARRAY[]::uuid[]) AS prompt_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'reasoning_levels'), ARRAY[]::uuid[]) AS reasoning_level_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'temperature_levels'), ARRAY[]::uuid[]) AS temperature_level_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'tools'), ARRAY[]::uuid[]) AS tool_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'voices'), ARRAY[]::uuid[]) AS voice_ids
FROM agent_drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active, d.group_id
WITH NO DATA;

CREATE UNIQUE INDEX mv_draft_agent_pk ON mv_draft_agent (draft_id);

REFRESH MATERIALIZED VIEW mv_draft_agent;
