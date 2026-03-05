-- Unified save scenario function - handles both create (input_scenario_id = NULL) and update (input_scenario_id provided)
-- Accepts flat resource IDs directly. No tool call tracking.
-- Denormalized scenarios_resource created inline or by Python (create_scenarios_internal).

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_save_scenario_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_scenario_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_save_scenario_v4(
    profile_id uuid,
    input_scenario_id uuid DEFAULT NULL,
    name_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
    problem_statement_id uuid DEFAULT NULL,
    flag_ids uuid[] DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    persona_ids uuid[] DEFAULT NULL,
    document_ids uuid[] DEFAULT NULL,
    parameter_ids uuid[] DEFAULT NULL,
    parameter_field_ids uuid[] DEFAULT NULL,
    image_ids uuid[] DEFAULT NULL,
    objective_ids uuid[] DEFAULT NULL,
    video_ids uuid[] DEFAULT NULL,
    question_ids uuid[] DEFAULT NULL,
    option_ids uuid[] DEFAULT NULL,
    scenarios_resource_id uuid DEFAULT NULL
)
RETURNS TABLE (
    scenario_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_scenario_id uuid;
    is_create boolean;
BEGIN
    -- Determine if create or update
    is_create := (input_scenario_id IS NULL);

    -- Validate required fields (only on create)
    IF is_create THEN
        IF name_id IS NULL THEN
            RAISE EXCEPTION 'Name resource is required';
        END IF;
    END IF;

    -- Create or update scenario_artifact
    IF is_create THEN
        INSERT INTO scenario_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_scenario_id;
    ELSE
        v_scenario_id := input_scenario_id;
        UPDATE scenario_artifact
        SET updated_at = NOW()
        WHERE id = v_scenario_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Scenario not found: %', input_scenario_id;
        END IF;

        -- COALESCE: fill NULL params from existing active junctions (partial update support)
        -- Single-select resources
        IF name_id IS NULL THEN
            name_id := (SELECT j.name_id FROM scenario_names_junction j WHERE j.scenario_id = v_scenario_id AND j.active LIMIT 1);
        END IF;
        IF description_id IS NULL THEN
            description_id := (SELECT j.description_id FROM scenario_descriptions_junction j WHERE j.scenario_id = v_scenario_id AND j.active LIMIT 1);
        END IF;
        IF problem_statement_id IS NULL THEN
            problem_statement_id := (SELECT j.problem_statement_id FROM scenario_problem_statements_junction j WHERE j.scenario_id = v_scenario_id AND j.active LIMIT 1);
        END IF;

        -- Multi-select arrays: preserve existing if NULL passed
        IF flag_ids IS NULL THEN
            flag_ids := COALESCE((SELECT ARRAY_AGG(j.flag_id) FROM scenario_flags_junction j WHERE j.scenario_id = v_scenario_id AND j.active), ARRAY[]::uuid[]);
        END IF;
        IF department_ids IS NULL THEN
            department_ids := COALESCE((SELECT ARRAY_AGG(j.department_id) FROM scenario_departments_junction j WHERE j.scenario_id = v_scenario_id AND j.active), ARRAY[]::uuid[]);
        END IF;
        IF persona_ids IS NULL THEN
            persona_ids := COALESCE((SELECT ARRAY_AGG(j.persona_id) FROM scenario_personas_junction j WHERE j.scenario_id = v_scenario_id AND j.active), ARRAY[]::uuid[]);
        END IF;
        IF document_ids IS NULL THEN
            document_ids := COALESCE((SELECT ARRAY_AGG(j.document_id) FROM scenario_documents_junction j WHERE j.scenario_id = v_scenario_id AND j.active), ARRAY[]::uuid[]);
        END IF;
        -- parameter_ids: no junction (scenario_parameters_junction was dropped), preserve as NULL
        IF parameter_field_ids IS NULL THEN
            parameter_field_ids := COALESCE((SELECT ARRAY_AGG(j.parameter_field_id) FROM scenario_parameter_fields_junction j WHERE j.scenario_id = v_scenario_id AND j.active), ARRAY[]::uuid[]);
        END IF;
        IF image_ids IS NULL THEN
            image_ids := COALESCE((SELECT ARRAY_AGG(j.image_id) FROM scenario_images_junction j WHERE j.scenario_id = v_scenario_id AND j.active), ARRAY[]::uuid[]);
        END IF;
        IF objective_ids IS NULL THEN
            objective_ids := COALESCE((SELECT ARRAY_AGG(j.objective_id ORDER BY j.idx) FROM scenario_objectives_junction j WHERE j.scenario_id = v_scenario_id AND j.active), ARRAY[]::uuid[]);
        END IF;
        IF video_ids IS NULL THEN
            video_ids := COALESCE((SELECT ARRAY_AGG(j.video_id) FROM scenario_videos_junction j WHERE j.scenario_id = v_scenario_id AND j.active), ARRAY[]::uuid[]);
        END IF;
        IF question_ids IS NULL THEN
            question_ids := COALESCE((SELECT ARRAY_AGG(j.question_id) FROM scenario_questions_junction j WHERE j.scenario_id = v_scenario_id AND j.active), ARRAY[]::uuid[]);
        END IF;
        IF option_ids IS NULL THEN
            option_ids := COALESCE((SELECT ARRAY_AGG(j.option_id) FROM scenario_options_junction j WHERE j.scenario_id = v_scenario_id AND j.active), ARRAY[]::uuid[]);
        END IF;
    END IF;

    -- Create scenarios_resource inline if not provided (partial update path)
    IF scenarios_resource_id IS NULL THEN
        INSERT INTO scenarios_resource (
            name, description, department_ids, persona_ids, parameter_ids, parameter_field_ids,
            problem_statement_enabled, objectives_enabled, video_enabled, images_enabled, questions_enabled,
            mcp, generated
        )
        SELECT
            n.name,
            d.description,
            COALESCE(api_save_scenario_v4.department_ids, ARRAY[]::uuid[]),
            COALESCE(api_save_scenario_v4.persona_ids, ARRAY[]::uuid[]),
            COALESCE(api_save_scenario_v4.parameter_ids, ARRAY[]::uuid[]),
            COALESCE(api_save_scenario_v4.parameter_field_ids, ARRAY[]::uuid[]),
            COALESCE((SELECT true FROM flags_resource fr WHERE fr.type = 'problem_statement_enabled' AND fr.id = ANY(COALESCE(api_save_scenario_v4.flag_ids, ARRAY[]::uuid[]))), false),
            COALESCE((SELECT true FROM flags_resource fr WHERE fr.type = 'objectives_enabled' AND fr.id = ANY(COALESCE(api_save_scenario_v4.flag_ids, ARRAY[]::uuid[]))), false),
            COALESCE((SELECT true FROM flags_resource fr WHERE fr.type = 'video_enabled' AND fr.id = ANY(COALESCE(api_save_scenario_v4.flag_ids, ARRAY[]::uuid[]))), false),
            COALESCE((SELECT true FROM flags_resource fr WHERE fr.type = 'images_enabled' AND fr.id = ANY(COALESCE(api_save_scenario_v4.flag_ids, ARRAY[]::uuid[]))), false),
            COALESCE((SELECT true FROM flags_resource fr WHERE fr.type = 'questions_enabled' AND fr.id = ANY(COALESCE(api_save_scenario_v4.flag_ids, ARRAY[]::uuid[]))), false),
            false,
            false
        FROM (SELECT 1) AS dummy
        LEFT JOIN names_resource n ON n.id = api_save_scenario_v4.name_id
        LEFT JOIN descriptions_resource d ON d.id = api_save_scenario_v4.description_id
        RETURNING id INTO scenarios_resource_id;
    END IF;

    -- For update: deactivate old junction rows (preserves history)
    IF NOT is_create THEN
        UPDATE scenario_names_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_descriptions_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_problem_statements_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_flags_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_departments_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_personas_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_documents_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_parameter_fields_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_images_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_objectives_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_videos_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_questions_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_options_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
    END IF;

    -- Upsert junction rows
    RETURN QUERY
    WITH params AS (
        SELECT
            v_scenario_id AS scenario_id,
            api_save_scenario_v4.name_id AS name_id,
            api_save_scenario_v4.description_id AS description_id,
            api_save_scenario_v4.problem_statement_id AS problem_statement_id,
            api_save_scenario_v4.flag_ids AS flag_ids,
            api_save_scenario_v4.department_ids AS department_ids,
            api_save_scenario_v4.persona_ids AS persona_ids,
            api_save_scenario_v4.document_ids AS document_ids,
            api_save_scenario_v4.parameter_field_ids AS parameter_field_ids,
            api_save_scenario_v4.image_ids AS image_ids,
            api_save_scenario_v4.objective_ids AS objective_ids,
            api_save_scenario_v4.video_ids AS video_ids,
            api_save_scenario_v4.question_ids AS question_ids,
            api_save_scenario_v4.option_ids AS option_ids,
            api_save_scenario_v4.scenarios_resource_id AS scenarios_resource_id
    ),
    -- Link name
    link_name AS (
        INSERT INTO scenario_names_junction (scenario_id, name_id, active, created_at, generated, mcp)
        SELECT x.scenario_id, x.name_id, true, NOW(), false, false
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT scenario_names_pkey DO UPDATE SET active = true, generated = false, mcp = false
    ),
    -- Link description
    link_description AS (
        INSERT INTO scenario_descriptions_junction (scenario_id, description_id, active, created_at, generated, mcp)
        SELECT x.scenario_id, x.description_id, true, NOW(), false, false
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT scenario_descriptions_pkey DO UPDATE SET active = true, generated = false, mcp = false
    ),
    -- Link problem statement
    link_problem_statement AS (
        INSERT INTO scenario_problem_statements_junction (scenario_id, problem_statement_id, active, created_at, generated, mcp)
        SELECT x.scenario_id, x.problem_statement_id, true, NOW(), false, false
        FROM params x
        WHERE x.problem_statement_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT scenario_problem_statements_pkey DO UPDATE SET active = true, generated = false, mcp = false
    ),
    -- Link flags
    link_flags AS (
        INSERT INTO scenario_flags_junction (scenario_id, flag_id, active, created_at, generated, mcp)
        SELECT x.scenario_id, fid, true, NOW(), false, false
        FROM params x
        CROSS JOIN UNNEST(x.flag_ids) AS fid
        WHERE COALESCE(array_length(x.flag_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT scenario_flags_pkey DO UPDATE SET active = true, generated = false, mcp = false
    ),
    -- Link departments
    link_departments AS (
        INSERT INTO scenario_departments_junction (scenario_id, department_id, active, created_at, generated, mcp)
        SELECT x.scenario_id, did, true, NOW(), false, false
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) AS did
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT scenario_departments_pkey DO UPDATE SET active = true, generated = false, mcp = false
    ),
    -- Link personas
    link_personas AS (
        INSERT INTO scenario_personas_junction (scenario_id, persona_id, active, created_at, generated, mcp)
        SELECT x.scenario_id, pid, true, NOW(), false, false
        FROM params x
        CROSS JOIN UNNEST(x.persona_ids) AS pid
        WHERE COALESCE(array_length(x.persona_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT scenario_personas_pkey DO UPDATE SET active = true, generated = false, mcp = false
    ),
    -- Link documents
    link_documents AS (
        INSERT INTO scenario_documents_junction (scenario_id, document_id, active, created_at, generated, mcp)
        SELECT x.scenario_id, docid, true, NOW(), false, false
        FROM params x
        CROSS JOIN UNNEST(x.document_ids) AS docid
        WHERE COALESCE(array_length(x.document_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT scenario_documents_pkey DO UPDATE SET active = true, generated = false, mcp = false
    ),
    -- Link parameter fields (parameter_field_ids passed directly, already resolved)
    link_parameter_fields AS (
        INSERT INTO scenario_parameter_fields_junction (scenario_id, parameter_field_id, active, created_at, generated, mcp)
        SELECT x.scenario_id, pfid, true, NOW(), false, false
        FROM params x
        CROSS JOIN UNNEST(x.parameter_field_ids) AS pfid
        WHERE COALESCE(array_length(x.parameter_field_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT scenario_parameter_fields_pkey DO UPDATE SET active = true, generated = false, mcp = false
    ),
    -- Link images
    link_images AS (
        INSERT INTO scenario_images_junction (scenario_id, image_id, active, created_at, generated, mcp)
        SELECT x.scenario_id, imgid, true, NOW(), false, false
        FROM params x
        CROSS JOIN UNNEST(x.image_ids) AS imgid
        WHERE COALESCE(array_length(x.image_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT scenario_images_pkey DO UPDATE SET active = true, generated = false, mcp = false
    ),
    -- Link objectives (with ordering via WITH ORDINALITY)
    link_objectives AS (
        INSERT INTO scenario_objectives_junction (scenario_id, objective_id, idx, active, created_at, generated, mcp)
        SELECT x.scenario_id, obj.id, obj.ord::integer - 1, true, NOW(), false, false
        FROM params x
        CROSS JOIN UNNEST(x.objective_ids) WITH ORDINALITY AS obj(id, ord)
        WHERE COALESCE(array_length(x.objective_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT scenario_objectives_pkey DO UPDATE SET
            idx = EXCLUDED.idx,
            active = true,
            created_at = EXCLUDED.created_at,
            generated = false,
            mcp = false
    ),
    -- Link videos
    link_videos AS (
        INSERT INTO scenario_videos_junction (scenario_id, video_id, active, created_at, generated, mcp)
        SELECT x.scenario_id, vid, true, NOW(), false, false
        FROM params x
        CROSS JOIN UNNEST(x.video_ids) AS vid
        WHERE COALESCE(array_length(x.video_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT scenario_videos_pkey DO UPDATE SET active = true, generated = false, mcp = false
    ),
    -- Link questions
    link_questions AS (
        INSERT INTO scenario_questions_junction (scenario_id, question_id, active, created_at, generated, mcp)
        SELECT x.scenario_id, qid, true, NOW(), false, false
        FROM params x
        CROSS JOIN UNNEST(x.question_ids) AS qid
        WHERE COALESCE(array_length(x.question_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT scenario_questions_pkey DO UPDATE SET active = true, generated = false, mcp = false
    ),
    -- Link options
    link_options AS (
        INSERT INTO scenario_options_junction (scenario_id, option_id, active, created_at, generated, mcp)
        SELECT x.scenario_id, oid, true, NOW(), false, false
        FROM params x
        CROSS JOIN UNNEST(x.option_ids) AS oid
        WHERE COALESCE(array_length(x.option_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT scenario_options_pkey DO UPDATE SET active = true, generated = false, mcp = false
    ),
    -- Deactivate old scenarios_resource link
    deactivate_old_resource AS (
        UPDATE scenario_scenarios_junction
        SET active = false
        FROM params p
        WHERE scenario_scenarios_junction.scenario_id = p.scenario_id
          AND scenario_scenarios_junction.active = true
    ),
    -- Link new scenarios_resource
    link_new_resource AS (
        INSERT INTO scenario_scenarios_junction (scenario_id, scenarios_id, active)
        SELECT x.scenario_id, x.scenarios_resource_id, true
        FROM params x
        WHERE x.scenarios_resource_id IS NOT NULL
    )
    SELECT x.scenario_id AS scenario_id
    FROM params x;
END;
$$;
