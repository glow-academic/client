-- Get tool_drafts entries by IDs from tool_drafts_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_tool_drafts_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_tool_drafts_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_tool_drafts_entries_v4(
    ids uuid[]
) RETURNS TABLE(
    items jsonb
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT jsonb_agg(
        jsonb_build_object(
            'draft_id', m.draft_id,
            'created_at', m.created_at,
            'updated_at', m.updated_at,
            'version', m.version,
            'generated', m.generated,
            'mcp', m.mcp,
            'active', m.active,
            'group_id', m.group_id,
            'arg_position_ids', m.arg_position_ids,
            'args_ids', m.args_ids,
            'args_output_ids', m.args_output_ids,
            'binding_ids', m.binding_ids,
            'department_ids', m.department_ids,
            'description_ids', m.description_ids,
            'domain_ids', m.domain_ids,
            'flag_ids', m.flag_ids,
            'name_ids', m.name_ids,
            'tool_ids', m.tool_ids
        )
    ) AS items
    FROM tool_drafts_mv m
    WHERE m.draft_id = ANY(ids);
END;
$$;
