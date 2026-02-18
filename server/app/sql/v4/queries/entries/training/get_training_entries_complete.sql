-- Get training entries by IDs from training_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_training_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_training_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_training_entries_v4(
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
            'training_entry_id', m.training_entry_id,
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
        )
    ) AS items
    FROM training_mv m
    WHERE m.training_entry_id = ANY(ids);
END;
$$;
