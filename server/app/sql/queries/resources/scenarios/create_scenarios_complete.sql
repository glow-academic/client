-- Create denormalized scenarios_resource from resolved resource IDs
-- Parameters: names_id, descriptions_id, department_ids, persona_ids, parameter_field_ids,
--             document_ids, objective_ids, image_ids, video_ids, question_ids, option_ids, problem_statement_ids,
--             problem_statement_enabled, objectives_enabled, video_enabled, images_enabled, questions_enabled
-- Returns: scenarios_resource_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_scenarios_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_scenarios_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_scenarios_v4(
    names_id uuid DEFAULT NULL,
    descriptions_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    persona_ids uuid[] DEFAULT ARRAY[]::uuid[],
    parameter_field_ids uuid[] DEFAULT ARRAY[]::uuid[],
    document_ids uuid[] DEFAULT ARRAY[]::uuid[],
    objective_ids uuid[] DEFAULT ARRAY[]::uuid[],
    image_ids uuid[] DEFAULT ARRAY[]::uuid[],
    video_ids uuid[] DEFAULT ARRAY[]::uuid[],
    question_ids uuid[] DEFAULT ARRAY[]::uuid[],
    option_ids uuid[] DEFAULT ARRAY[]::uuid[],
    problem_statement_ids uuid[] DEFAULT ARRAY[]::uuid[],
    problem_statement_enabled boolean DEFAULT true,
    objectives_enabled boolean DEFAULT true,
    video_enabled boolean DEFAULT false,
    images_enabled boolean DEFAULT false,
    questions_enabled boolean DEFAULT false,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    scenarios_resource_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_resource_id uuid;
BEGIN
    INSERT INTO scenarios_resource (
        name,
        description,
        department_ids,
        persona_ids,
        parameter_field_ids,
        document_ids,
        objective_ids,
        image_ids,
        video_ids,
        question_ids,
        option_ids,
        problem_statement_ids,
        problem_statement_enabled,
        objectives_enabled,
        video_enabled,
        images_enabled,
        questions_enabled,
        mcp,
        generated
    )
    SELECT
        n.name,
        d.description,
        api_create_scenarios_v4.department_ids,
        api_create_scenarios_v4.persona_ids,
        api_create_scenarios_v4.parameter_field_ids,
        api_create_scenarios_v4.document_ids,
        api_create_scenarios_v4.objective_ids,
        api_create_scenarios_v4.image_ids,
        api_create_scenarios_v4.video_ids,
        api_create_scenarios_v4.question_ids,
        api_create_scenarios_v4.option_ids,
        api_create_scenarios_v4.problem_statement_ids,
        api_create_scenarios_v4.problem_statement_enabled,
        api_create_scenarios_v4.objectives_enabled,
        api_create_scenarios_v4.video_enabled,
        api_create_scenarios_v4.images_enabled,
        api_create_scenarios_v4.questions_enabled,
        api_create_scenarios_v4.mcp,
        api_create_scenarios_v4.mcp
    FROM (SELECT 1) AS dummy
    LEFT JOIN names_resource n ON n.id = api_create_scenarios_v4.names_id
    LEFT JOIN descriptions_resource d ON d.id = api_create_scenarios_v4.descriptions_id
    RETURNING id INTO v_resource_id;

    RETURN QUERY SELECT v_resource_id;
END;
$$;
