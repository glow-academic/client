-- Materialized View: tool_drafts_mv
-- Per-artifact draft MV for tool drafts with denormalized resource IDs.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'tool_drafts_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS tool_drafts_mv CASCADE;

CREATE MATERIALIZED VIEW tool_drafts_mv AS
WITH draft_links AS (
    SELECT draft_id, 'arg_positions'::text AS resource_type, arg_positions_id AS resource_id FROM tool_drafts_arg_positions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'args'::text AS resource_type, args_id AS resource_id FROM tool_drafts_args_connection WHERE active = true
    UNION ALL SELECT draft_id, 'args_outputs'::text AS resource_type, args_outputs_id AS resource_id FROM tool_drafts_args_outputs_connection WHERE active = true
    UNION ALL SELECT draft_id, 'bindings'::text AS resource_type, bindings_id AS resource_id FROM tool_drafts_bindings_connection WHERE active = true
    UNION ALL SELECT draft_id, 'departments'::text AS resource_type, departments_id AS resource_id FROM tool_drafts_departments_connection WHERE active = true
    UNION ALL SELECT draft_id, 'descriptions'::text AS resource_type, descriptions_id AS resource_id FROM tool_drafts_descriptions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'domains'::text AS resource_type, domains_id AS resource_id FROM tool_drafts_domains_connection WHERE active = true
    UNION ALL SELECT draft_id, 'flags'::text AS resource_type, flags_id AS resource_id FROM tool_drafts_flags_connection WHERE active = true
    UNION ALL SELECT draft_id, 'names'::text AS resource_type, names_id AS resource_id FROM tool_drafts_names_connection WHERE active = true
    UNION ALL SELECT draft_id, 'tools'::text AS resource_type, tools_id AS resource_id FROM tool_drafts_tools_connection WHERE active = true
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
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'arg_positions'), ARRAY[]::uuid[]) AS arg_position_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'args'), ARRAY[]::uuid[]) AS args_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'args_outputs'), ARRAY[]::uuid[]) AS args_output_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'bindings'), ARRAY[]::uuid[]) AS binding_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'departments'), ARRAY[]::uuid[]) AS department_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'descriptions'), ARRAY[]::uuid[]) AS description_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'domains'), ARRAY[]::uuid[]) AS domain_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'), ARRAY[]::uuid[]) AS name_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'tools'), ARRAY[]::uuid[]) AS tool_ids
FROM tool_drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active, d.group_id
WITH NO DATA;

CREATE UNIQUE INDEX tool_drafts_mv_pk ON tool_drafts_mv (draft_id);

REFRESH MATERIALIZED VIEW tool_drafts_mv;
