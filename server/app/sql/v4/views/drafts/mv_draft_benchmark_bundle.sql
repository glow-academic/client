-- Materialized View: mv_draft_benchmark_bundle
-- Per-artifact draft MV for benchmark bundle drafts with denormalized resource IDs.
-- Mirrors the resource arrays of mv_benchmark_bundle.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_draft_benchmark_bundle'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS mv_draft_benchmark_bundle CASCADE;

CREATE MATERIALIZED VIEW mv_draft_benchmark_bundle AS
WITH draft_links AS (
    SELECT draft_id, 'departments'::resource_type AS resource_type, departments_id::uuid AS resource_id FROM departments_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'models'::resource_type AS resource_type, models_id::uuid AS resource_id FROM models_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'prompts'::resource_type AS resource_type, prompts_id::uuid AS resource_id FROM prompts_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'instructions'::resource_type AS resource_type, instructions_id::uuid AS resource_id FROM instructions_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'voices'::resource_type AS resource_type, voices_id::uuid AS resource_id FROM voices_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'temperature_levels'::resource_type AS resource_type, temperature_levels_id::uuid AS resource_id FROM temperature_levels_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'reasoning_levels'::resource_type AS resource_type, reasoning_levels_id::uuid AS resource_id FROM reasoning_levels_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'tools'::resource_type AS resource_type, tools_id::uuid AS resource_id FROM tools_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'keys'::resource_type AS resource_type, keys_id::uuid AS resource_id FROM keys_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'flags'::resource_type AS resource_type, flags_id::uuid AS resource_id FROM flags_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'names'::resource_type AS resource_type, names_id::uuid AS resource_id FROM names_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'descriptions'::resource_type AS resource_type, descriptions_id::uuid AS resource_id FROM descriptions_drafts_connection WHERE active = true
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
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'departments'::resource_type), ARRAY[]::uuid[]) AS department_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'models'::resource_type), ARRAY[]::uuid[]) AS model_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'prompts'::resource_type), ARRAY[]::uuid[]) AS prompt_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'instructions'::resource_type), ARRAY[]::uuid[]) AS instruction_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'voices'::resource_type), ARRAY[]::uuid[]) AS voice_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'temperature_levels'::resource_type), ARRAY[]::uuid[]) AS temperature_level_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'reasoning_levels'::resource_type), ARRAY[]::uuid[]) AS reasoning_level_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'tools'::resource_type), ARRAY[]::uuid[]) AS tool_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'keys'::resource_type), ARRAY[]::uuid[]) AS key_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'::resource_type), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'::resource_type), ARRAY[]::uuid[]) AS name_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'descriptions'::resource_type), ARRAY[]::uuid[]) AS description_ids
FROM drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
WHERE d.artifact = 'benchmark'::artifact_type
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active
WITH NO DATA;

CREATE UNIQUE INDEX mv_draft_benchmark_bundle_pk ON mv_draft_benchmark_bundle (draft_id);

REFRESH MATERIALIZED VIEW mv_draft_benchmark_bundle;
