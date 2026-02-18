-- Get eval_drafts entries by IDs from eval_drafts_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_eval_drafts_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_eval_drafts_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_eval_drafts_entries_v4(
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
            'department_ids', m.department_ids,
            'description_ids', m.description_ids,
            'eval_ids', m.eval_ids,
            'flag_ids', m.flag_ids,
            'group_position_ids', m.group_position_ids,
            'group_rubric_ids', m.group_rubric_ids,
            'group_ids', m.group_ids,
            'name_ids', m.name_ids,
            'run_position_ids', m.run_position_ids,
            'run_rubric_ids', m.run_rubric_ids,
            'run_ids', m.run_ids
        )
    ) AS items
    FROM eval_drafts_mv m
    WHERE m.draft_id = ANY(ids);
END;
$$;
