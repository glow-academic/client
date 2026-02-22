-- Search chat entries from chat_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_chat_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_chat_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_chat_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    parent_id uuid DEFAULT NULL,
    scenario_id uuid DEFAULT NULL
) RETURNS TABLE(
    items jsonb
)
LANGUAGE plpgsql STABLE
AS $$
#variable_conflict use_variable
BEGIN
    RETURN QUERY
    SELECT jsonb_agg(row_data) AS items
    FROM (
        SELECT jsonb_build_object(
            'chat_entry_id', m.chat_entry_id,
            'parent_id', m.parent_id,
            'scenario_id', m.scenario_id,
            'department_ids', m.department_ids,
            'persona_ids', m.persona_ids,
            'document_ids', m.document_ids,
            'parameter_field_ids', m.parameter_field_ids,
            'parameter_ids', m.parameter_ids,
            'question_ids', m.question_ids,
            'option_ids', m.option_ids,
            'video_ids', m.video_ids,
            'image_ids', m.image_ids,
            'problem_statement_ids', m.problem_statement_ids,
            'objective_ids', m.objective_ids,
            'flag_ids', m.flag_ids,
            'name_ids', m.name_ids,
            'description_ids', m.description_ids,
            'video_enabled', m.video_enabled,
            'problem_statement_enabled', m.problem_statement_enabled,
            'objectives_enabled', m.objectives_enabled,
            'images_enabled', m.images_enabled,
            'questions_enabled', m.questions_enabled,
            'created_at', m.created_at,
            'updated_at', m.updated_at,
            'active', m.active
        ) AS row_data
        FROM chat_mv m
        WHERE true
          AND (parent_id IS NULL OR m.parent_id = parent_id)
          AND (scenario_id IS NULL OR m.scenario_id = scenario_id)
        ORDER BY m.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
