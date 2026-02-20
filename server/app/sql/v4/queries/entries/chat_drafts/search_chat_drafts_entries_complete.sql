-- Search chat_drafts entries from chat_drafts_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_chat_drafts_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_chat_drafts_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_chat_drafts_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    group_id uuid DEFAULT NULL
) RETURNS TABLE(
    items jsonb
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT jsonb_agg(row_data) AS items
    FROM (
        SELECT jsonb_build_object(
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
            'document_ids', m.document_ids,
            'field_ids', m.field_ids,
            'flag_ids', m.flag_ids,
            'image_ids', m.image_ids,
            'name_ids', m.name_ids,
            'objective_ids', m.objective_ids,
            'option_ids', m.option_ids,
            'parameter_field_ids', m.parameter_field_ids,
            'parameter_ids', m.parameter_ids,
            'persona_ids', m.persona_ids,
            'problem_statement_ids', m.problem_statement_ids,
            'question_ids', m.question_ids,
            'scenario_ids', m.scenario_ids,
            'video_ids', m.video_ids
        ) AS row_data
        FROM chat_drafts_mv m
        WHERE true
          AND (group_id IS NULL OR m.group_id = group_id)
        ORDER BY m.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
