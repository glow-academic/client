-- Create scenario with all relationships in a single transaction
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
DROP FUNCTION IF EXISTS api_create_scenario_v3(text, text, boolean, boolean, boolean, boolean, boolean, boolean, uuid, text, text, text[], text[], text[], text[], text[], text[], text[], jsonb, text[], text, text[], jsonb, uuid, text[], uuid);

-- 2) Drop types WITHOUT CASCADE
-- No composite types needed for this simple endpoint

-- 3) Recreate function
CREATE OR REPLACE FUNCTION api_create_scenario_v3(
    name text,
    active boolean,
    objectives_enabled boolean,
    images_enabled boolean,
    video_enabled boolean,
    questions_enabled boolean,
    problem_statement_enabled boolean,
    problem_statement text,
    document_ids text[],
    objective_ids text[],
    parameter_item_ids text[],
    profile_id uuid,
    description text DEFAULT NULL,
    video_agent_id uuid DEFAULT NULL,
    problem_statement_name text DEFAULT NULL,
    problem_statement_versions text[] DEFAULT NULL,
    department_ids text[] DEFAULT NULL,
    persona_ids text[] DEFAULT NULL,
    template_document_ids text[] DEFAULT NULL,
    upload_images_json jsonb DEFAULT NULL,
    video_ids text[] DEFAULT NULL,
    active_video_id text DEFAULT NULL,
    question_ids text[] DEFAULT NULL,
    question_timestamps jsonb DEFAULT NULL,
    run_id uuid DEFAULT NULL,
    parameter_ids text[] DEFAULT NULL
)
RETURNS TABLE (
    scenario_id uuid,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT
        name AS name,
        COALESCE(NULLIF(description, ''), '') AS description,
        active AS active,
        objectives_enabled AS objectives_enabled,
        images_enabled AS images_enabled,
        video_enabled AS video_enabled,
        questions_enabled AS questions_enabled,
        problem_statement_enabled AS problem_statement_enabled,
        video_agent_id AS video_agent_id,
        problem_statement AS problem_statement,
        COALESCE(problem_statement_name, name) AS problem_statement_name,
        COALESCE(problem_statement_versions, ARRAY[]::text[]) AS problem_statement_versions,
        COALESCE(department_ids, ARRAY[]::text[]) AS department_ids,
        COALESCE(persona_ids, ARRAY[]::text[]) AS persona_ids,
        COALESCE(document_ids, ARRAY[]::text[]) AS document_ids,
        COALESCE(template_document_ids, ARRAY[]::text[]) AS template_document_ids,
        COALESCE(objective_ids, ARRAY[]::text[]) AS objective_ids,
        COALESCE(parameter_item_ids, ARRAY[]::text[]) AS parameter_item_ids,
        COALESCE(upload_images_json, '[]'::jsonb) AS upload_images_json,
        COALESCE(video_ids, ARRAY[]::text[]) AS video_ids,
        active_video_id AS active_video_id,
        COALESCE(question_ids, ARRAY[]::text[]) AS question_ids,
        question_timestamps AS question_timestamps,
        run_id AS run_id,
        COALESCE(parameter_ids, ARRAY[]::text[]) AS parameter_ids,
        profile_id AS profile_id
),
user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
validate_create_permissions AS (
    -- Validate department permissions for create operation
    SELECT validate_department_create_permissions(
        up.role::text,
        (SELECT department_ids FROM params)
    ) as validation_passed
    FROM user_profile up
),
actor_profile AS (
    SELECT 
        (SELECT profile_id FROM params) as resolved_profile_id,
        up.actor_name
    FROM user_profile up
),
new_scenario AS (
    INSERT INTO scenarios (
        name,
        description,
        active,
        objectives_enabled,
        images_enabled,
        video_enabled,
        questions_enabled,
        problem_statement_enabled,
        video_agent_id
    )
    SELECT 
        (SELECT name FROM params), 
        (SELECT description FROM params), 
        (SELECT active FROM params), 
        (SELECT objectives_enabled FROM params), 
        (SELECT images_enabled FROM params), 
        (SELECT video_enabled FROM params), 
        (SELECT questions_enabled FROM params), 
        (SELECT problem_statement_enabled FROM params), 
        (SELECT video_agent_id FROM params)
    RETURNING id
),
link_departments AS (
    -- Link departments if provided
    INSERT INTO scenario_departments (scenario_id, department_id, active, created_at, updated_at)
    SELECT 
        ns.id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN UNNEST((SELECT department_ids FROM params)) as dept_id
    WHERE COALESCE(array_length((SELECT department_ids FROM params), 1), 0) > 0
    ON CONFLICT (scenario_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_scenario_parameters AS (
    -- Link parameters if provided (array is never NULL, but may be empty)
    INSERT INTO scenario_parameters (scenario_id, parameter_id, active, created_at, updated_at)
    SELECT 
        ns.id,
        param_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN UNNEST((SELECT parameter_ids FROM params)) as param_id
    WHERE COALESCE(array_length((SELECT parameter_ids FROM params), 1), 0) > 0
    ON CONFLICT (scenario_id, parameter_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_tree_edge AS (
    -- Insert self-referencing edge in scenario_tree (marks as root)
    INSERT INTO scenario_tree (parent_id, child_id, active)
    SELECT ns.id, ns.id, true
    FROM new_scenario ns
),
problem_statement_versions_data AS (
    -- Prepare problem statement versions
    SELECT DISTINCT version_text
    FROM new_scenario ns
    CROSS JOIN UNNEST((SELECT problem_statement_versions FROM params)) as version_text
    WHERE COALESCE(array_length((SELECT problem_statement_versions FROM params), 1), 0) > 0
    UNION ALL
    -- If no versions provided, use single problem statement
    SELECT (SELECT problem_statement FROM params) as version_text
    FROM new_scenario ns
    WHERE COALESCE(array_length((SELECT problem_statement_versions FROM params), 1), 0) = 0 
      AND (SELECT problem_statement FROM params) IS NOT NULL 
      AND (SELECT problem_statement FROM params) != ''
),
create_problem_statements AS (
    -- Create problem_statement records first (strong entity)
    -- Always create new records (don't reuse) to allow different names for same text
    INSERT INTO problem_statements (name, problem_statement, created_at, updated_at)
    SELECT 
        (SELECT problem_statement_name FROM params) as name,
        psd.version_text,
        NOW(),
        NOW()
    FROM problem_statement_versions_data psd
    RETURNING id as problem_statement_id, problem_statement
),
link_problem_statements AS (
    -- Link problem statements to scenario via junction table
    INSERT INTO scenario_problem_statements (scenario_id, problem_statement_id, active, created_at, updated_at)
    SELECT 
        ns.id,
        cps.problem_statement_id,
        CASE 
            WHEN cps.problem_statement = (SELECT problem_statement FROM params) THEN true
            ELSE false
        END as active,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN create_problem_statements cps
),
link_personas AS (
    -- Link personas if provided
    INSERT INTO scenario_personas (scenario_id, persona_id, active, created_at, updated_at)
    SELECT 
        ns.id,
        persona_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN UNNEST((SELECT persona_ids FROM params)) as persona_id
    WHERE COALESCE(array_length((SELECT persona_ids FROM params), 1), 0) > 0
    ON CONFLICT (scenario_id, persona_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_documents AS (
    -- Link documents (both regular and template documents)
    INSERT INTO scenario_documents (scenario_id, document_id, active, created_at, updated_at)
    SELECT 
        ns.id,
        doc_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN (
        SELECT doc_id FROM UNNEST((SELECT document_ids FROM params)) as doc_id
        UNION ALL
        SELECT doc_id FROM UNNEST((SELECT template_document_ids FROM params)) as doc_id
    ) all_docs
    WHERE COALESCE(array_length((SELECT document_ids FROM params), 1), 0) > 0 
       OR COALESCE(array_length((SELECT template_document_ids FROM params), 1), 0) > 0
    ON CONFLICT (scenario_id, document_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
objectives_with_index AS (
    -- Prepare objectives with their index (skip composite IDs - filtered in Python)
    SELECT 
        obj_text,
        ROW_NUMBER() OVER () - 1 as idx
    FROM UNNEST((SELECT objective_ids FROM params)) as obj_text
    WHERE COALESCE(array_length((SELECT objective_ids FROM params), 1), 0) > 0
),
existing_objectives AS (
    -- Find existing objectives by text
    SELECT id as objective_id, objective
    FROM objectives
    WHERE objective = ANY(SELECT obj_text FROM objectives_with_index)
),
new_objectives AS (
    -- Create new objectives that don't exist yet
    INSERT INTO objectives (objective, created_at, updated_at)
    SELECT DISTINCT
        owi.obj_text,
        NOW(),
        NOW()
    FROM objectives_with_index owi
    WHERE NOT EXISTS (
        SELECT 1 FROM existing_objectives eo WHERE eo.objective = owi.obj_text
    )
    RETURNING id as objective_id, objective
),
all_objectives AS (
    -- Combine existing and new objectives
    SELECT objective_id, objective FROM existing_objectives
    UNION ALL
    SELECT objective_id, objective FROM new_objectives
),
link_objectives AS (
    -- Link objectives to scenario via junction table
    INSERT INTO scenario_objectives (scenario_id, objective_id, idx, created_at)
    SELECT 
        ns.id,
        ao.objective_id,
        owi.idx,
        NOW()
    FROM new_scenario ns
    CROSS JOIN objectives_with_index owi
    JOIN all_objectives ao ON ao.objective = owi.obj_text
),
link_parameters AS (
    -- Link fields
    INSERT INTO scenario_fields (scenario_id, field_id, active, created_at, updated_at)
    SELECT 
        ns.id,
        field_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN UNNEST((SELECT parameter_item_ids FROM params)) as field_id
    WHERE COALESCE(array_length((SELECT parameter_item_ids FROM params), 1), 0) > 0
    ON CONFLICT (scenario_id, field_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
create_images AS (
    -- Create images if they don't exist
    INSERT INTO images (name, created_at, updated_at, active)
    SELECT DISTINCT
        img->>'name',
        NOW(),
        NOW(),
        true
    FROM jsonb_array_elements((SELECT upload_images_json FROM params)) as img
    WHERE jsonb_array_length((SELECT upload_images_json FROM params)) > 0
      AND NOT EXISTS (
          SELECT 1 FROM images i
          JOIN image_uploads iu ON iu.image_id = i.id
          WHERE iu.upload_id = (img->>'upload_id')::uuid AND i.name = img->>'name'
      )
    RETURNING id as image_id
),
link_image_uploads AS (
    -- Link images to uploads via junction table
    INSERT INTO image_uploads (image_id, upload_id, active, created_at, updated_at)
    SELECT DISTINCT
        ci.image_id,
        (img->>'upload_id')::uuid,
        true,
        NOW(),
        NOW()
    FROM create_images ci
    CROSS JOIN jsonb_array_elements((SELECT upload_images_json FROM params)) as img
    WHERE jsonb_array_length((SELECT upload_images_json FROM params)) > 0
    ON CONFLICT (image_id, upload_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
    RETURNING image_id, upload_id
),
get_images AS (
    -- Get existing images via image_uploads junction table
    SELECT i.id as image_id, iu.upload_id
    FROM jsonb_array_elements((SELECT upload_images_json FROM params)) as img
    JOIN image_uploads iu ON iu.upload_id = (img->>'upload_id')::uuid
    JOIN images i ON i.id = iu.image_id AND i.name = img->>'name'
    WHERE iu.active = true
),
all_images AS (
    SELECT image_id, upload_id FROM link_image_uploads
    UNION
    SELECT image_id, upload_id FROM get_images
),
link_images AS (
    -- Link images to scenario via junction table
    INSERT INTO scenario_images (scenario_id, image_id, active, created_at, updated_at)
    SELECT 
        ns.id,
        ai.image_id,
        true,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN all_images ai
    WHERE jsonb_array_length((SELECT upload_images_json FROM params)) > 0
    ON CONFLICT (scenario_id, image_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_problem_statements_to_runs AS (
    -- Link problem statements to run via tool_call if run_id provided
    SELECT DISTINCT
        cps.problem_statement_id,
        (SELECT run_id FROM params) as run_id
    FROM create_problem_statements cps
    WHERE (SELECT run_id FROM params) IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM problem_statements ps
        JOIN tool_calls tc ON tc.id = ps.tool_call_id
        JOIN tool_call_runs tcr ON tcr.tool_call_id = tc.id
        WHERE ps.id = cps.problem_statement_id
        AND tcr.run_id = (SELECT run_id FROM params)
    )
),
link_objectives_to_runs AS (
    -- Link objectives to run via tool_call if run_id provided
    SELECT DISTINCT
        ao.objective_id,
        (SELECT run_id FROM params) as run_id
    FROM all_objectives ao
    WHERE (SELECT run_id FROM params) IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM objectives o
        JOIN tool_calls tc ON tc.id = o.tool_call_id
        JOIN tool_call_runs tcr ON tcr.tool_call_id = tc.id
        WHERE o.id = ao.objective_id
        AND tcr.run_id = (SELECT run_id FROM params)
    )
),
link_videos AS (
    -- Link videos to scenario via junction table
    INSERT INTO scenario_videos (scenario_id, video_id, active, created_at, updated_at)
    SELECT 
        ns.id,
        video_id::uuid,
        CASE 
            WHEN video_id::text = (SELECT active_video_id FROM params) THEN true
            ELSE false
        END as active,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN UNNEST((SELECT video_ids FROM params)) as video_id
    WHERE COALESCE(array_length((SELECT video_ids FROM params), 1), 0) > 0
    ON CONFLICT (scenario_id, video_id) DO UPDATE SET
        active = CASE 
            WHEN (scenario_videos.video_id)::text = (SELECT active_video_id FROM params) THEN true
            ELSE false
        END,
        updated_at = NOW()
),
link_questions AS (
    -- Link questions to scenario via junction table
    INSERT INTO scenario_questions (scenario_id, question_id, active, created_at, updated_at)
    SELECT 
        ns.id,
        question_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN UNNEST((SELECT question_ids FROM params)) as question_id
    WHERE COALESCE(array_length((SELECT question_ids FROM params), 1), 0) > 0
    ON CONFLICT (scenario_id, question_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_question_times AS (
    -- Link question times to videos
    INSERT INTO scenario_question_times (scenario_id, question_id, video_id, time, active, created_at, updated_at)
    SELECT 
        ns.id,
        (q_entry.key)::uuid as question_id,
        (v_entry.key)::uuid as video_id,
        time_val::numeric as time,
        true,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN jsonb_each(COALESCE((SELECT question_timestamps FROM params), '{}'::jsonb)) as q_entry
    CROSS JOIN jsonb_each(q_entry.value) as v_entry
    CROSS JOIN jsonb_array_elements_text(v_entry.value) as time_val
    WHERE (SELECT question_timestamps FROM params) IS NOT NULL
    AND jsonb_typeof((SELECT question_timestamps FROM params)) = 'object'
    ON CONFLICT (scenario_id, question_id, video_id, time) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_image_departments AS (
    INSERT INTO image_departments (image_id, department_id, active, created_at, updated_at)
    SELECT DISTINCT
        ai.image_id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM all_images ai
    CROSS JOIN new_scenario ns
    CROSS JOIN UNNEST((SELECT department_ids FROM params)) as dept_id
    WHERE COALESCE(array_length((SELECT department_ids FROM params), 1), 0) > 0
    ON CONFLICT (image_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_video_departments AS (
    INSERT INTO video_departments (video_id, department_id, active, created_at, updated_at)
    SELECT DISTINCT
        vid::uuid as video_id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST((SELECT video_ids FROM params)) as vid
    CROSS JOIN UNNEST((SELECT department_ids FROM params)) as dept_id
    WHERE COALESCE(array_length((SELECT video_ids FROM params), 1), 0) > 0
    AND COALESCE(array_length((SELECT department_ids FROM params), 1), 0) > 0
    ON CONFLICT (video_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_objective_departments AS (
    INSERT INTO objective_departments (objective_id, department_id, active, created_at, updated_at)
    SELECT DISTINCT
        ao.objective_id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM all_objectives ao
    CROSS JOIN UNNEST((SELECT department_ids FROM params)) as dept_id
    WHERE COALESCE(array_length((SELECT department_ids FROM params), 1), 0) > 0
    ON CONFLICT (objective_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_question_departments AS (
    INSERT INTO question_departments (question_id, department_id, active, created_at, updated_at)
    SELECT DISTINCT
        question_id::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST((SELECT question_ids FROM params)) as question_id
    CROSS JOIN UNNEST((SELECT department_ids FROM params)) as dept_id
    WHERE COALESCE(array_length((SELECT question_ids FROM params), 1), 0) > 0
    AND COALESCE(array_length((SELECT department_ids FROM params), 1), 0) > 0
    ON CONFLICT (question_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_problem_statement_departments AS (
    INSERT INTO problem_statement_departments (problem_statement_id, department_id, active, created_at, updated_at)
    SELECT DISTINCT
        cps.problem_statement_id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM create_problem_statements cps
    CROSS JOIN UNNEST((SELECT department_ids FROM params)) as dept_id
    WHERE COALESCE(array_length((SELECT department_ids FROM params), 1), 0) > 0
    ON CONFLICT (problem_statement_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
create_persona_ranges AS (
    INSERT INTO scenario_persona_ranges (scenario_id, min_count, max_count)
    SELECT ns.id, 1, 3
    FROM new_scenario ns
    ON CONFLICT (scenario_id) DO UPDATE SET
        updated_at = NOW()
),
create_document_ranges AS (
    INSERT INTO scenario_document_ranges (scenario_id, min_count, max_count)
    SELECT ns.id, 0, 3
    FROM new_scenario ns
    ON CONFLICT (scenario_id) DO UPDATE SET
        updated_at = NOW()
),
create_parameter_ranges AS (
    INSERT INTO scenario_parameter_ranges (scenario_id, min_count, max_count)
    SELECT ns.id, 0, 3
    FROM new_scenario ns
    ON CONFLICT (scenario_id) DO UPDATE SET
        updated_at = NOW()
),
create_field_ranges AS (
    INSERT INTO scenario_field_ranges (scenario_id, parameter_id, min_count, max_count)
    SELECT 
        ns.id,
        param_id::uuid,
        1,
        3
    FROM new_scenario ns
    CROSS JOIN UNNEST((SELECT parameter_ids FROM params)) as param_id
    WHERE COALESCE(array_length((SELECT parameter_ids FROM params), 1), 0) > 0
    ON CONFLICT (scenario_id, parameter_id) DO UPDATE SET
        updated_at = NOW()
)
SELECT 
    ns.id as scenario_id,
    ap.actor_name::text as actor_name
FROM new_scenario ns
CROSS JOIN actor_profile ap
$$;

COMMIT;
