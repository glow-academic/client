-- Update scenario with all relationships in a single transaction
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_update_scenario_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_update_scenario_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_update_scenario_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types (separate from create_scenario)
CREATE TYPE types.q_update_scenario_v4_parameter AS (
    parameter_id uuid,
    field_ids uuid[]
);

CREATE TYPE types.q_update_scenario_v4_question_timestamp AS (
    question_id uuid,
    video_id uuid,
    timestamps numeric[]
);

CREATE TYPE types.q_update_scenario_v4_upload_image AS (
    upload_id uuid,
    name text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_update_scenario_v4(
    scenario_id uuid,
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
    parameters types.q_update_scenario_v4_parameter[],
    profile_id uuid,
    description text DEFAULT NULL,
    video_agent_id uuid DEFAULT NULL,
    problem_statement_name text DEFAULT NULL,
    department_ids text[] DEFAULT NULL,
    persona_ids text[] DEFAULT NULL,
    template_document_ids text[] DEFAULT NULL,
    upload_ids uuid[] DEFAULT NULL,
    image_names text[] DEFAULT NULL,
    video_ids text[] DEFAULT NULL,
    active_video_id text DEFAULT NULL,
    question_ids text[] DEFAULT NULL,
    question_timestamps types.q_update_scenario_v4_question_timestamp[] DEFAULT ARRAY[]::types.q_update_scenario_v4_question_timestamp[],
    scenario_agent_id uuid DEFAULT NULL,
    image_agent_id uuid DEFAULT NULL
)
RETURNS TABLE (
    scenario_exists boolean,
    scenario_id uuid,
    name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH raw_params AS (
    SELECT
        scenario_id AS scenario_id,
        name AS name,
        description AS description,
        active AS active,
        objectives_enabled AS objectives_enabled,
        images_enabled AS images_enabled,
        video_enabled AS video_enabled,
        questions_enabled AS questions_enabled,
        problem_statement_enabled AS problem_statement_enabled,
        video_agent_id AS video_agent_id,
        problem_statement AS problem_statement,
        problem_statement_name AS problem_statement_name,
        department_ids AS department_ids,
        persona_ids AS persona_ids,
        document_ids AS document_ids,
        template_document_ids AS template_document_ids,
        objective_ids AS objective_ids,
        parameters AS parameters,
        upload_ids AS upload_ids,
        image_names AS image_names,
        scenario_agent_id AS scenario_agent_id,
        image_agent_id AS image_agent_id,
        video_ids AS video_ids,
        active_video_id AS active_video_id,
        question_ids AS question_ids,
        question_timestamps AS question_timestamps,
        profile_id AS profile_id
),
-- Preprocessing: Filter composite objective IDs (those with "_" and length 2 when split)
filtered_objective_ids AS (
    SELECT ARRAY_AGG(obj_id) FILTER (WHERE obj_id IS NOT NULL) as objective_ids
    FROM raw_params rp
    CROSS JOIN UNNEST(COALESCE(rp.objective_ids, ARRAY[]::text[])) as obj_id
    WHERE NOT (obj_id LIKE '%_%' AND array_length(string_to_array(obj_id, '_'), 1) = 2)
),
-- Preprocessing: Extract parameter_item_ids and parameter_ids from parameters composite type array
parameter_preprocessing AS (
    SELECT
        COALESCE(
            ARRAY_AGG(DISTINCT field_id::text) FILTER (WHERE field_id IS NOT NULL),
            ARRAY[]::text[]
        ) as parameter_item_ids,
        COALESCE(
            ARRAY_AGG(DISTINCT param.parameter_id::text) FILTER (WHERE param.parameter_id IS NOT NULL),
            ARRAY[]::text[]
        ) as parameter_ids
    FROM raw_params rp
    CROSS JOIN UNNEST(COALESCE(rp.parameters, ARRAY[]::types.q_update_scenario_v4_parameter[])) as param
    CROSS JOIN UNNEST(COALESCE(param.field_ids, ARRAY[]::uuid[])) as field_id
),
-- Preprocessing: Construct upload_images array from upload_ids and image_names arrays
upload_images_preprocessing AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (upload_id, image_name)::types.q_update_scenario_v4_upload_image
                ORDER BY idx
            ),
            '{}'::types.q_update_scenario_v4_upload_image[]
        ) as upload_images
    FROM raw_params rp
    CROSS JOIN LATERAL (
        SELECT 
            upload_id,
            image_name,
            ROW_NUMBER() OVER () - 1 as idx
        FROM UNNEST(
            COALESCE(rp.upload_ids, ARRAY[]::uuid[]),
            COALESCE(rp.image_names, ARRAY[]::text[])
        ) as t(upload_id, image_name)
    ) paired
    WHERE rp.upload_ids IS NOT NULL 
      AND rp.image_names IS NOT NULL
      AND array_length(rp.upload_ids, 1) = array_length(rp.image_names, 1)
      AND array_length(rp.upload_ids, 1) > 0
),
params AS (
    SELECT
        rp.scenario_id AS scenario_id,
        rp.name AS name,
        COALESCE(NULLIF(rp.description, ''), '') AS description,
        rp.active AS active,
        rp.objectives_enabled AS objectives_enabled,
        rp.images_enabled AS images_enabled,
        rp.video_enabled AS video_enabled,
        rp.questions_enabled AS questions_enabled,
        rp.problem_statement_enabled AS problem_statement_enabled,
        rp.video_agent_id AS video_agent_id,
        rp.problem_statement AS problem_statement,
        COALESCE(rp.problem_statement_name, rp.name) AS problem_statement_name,
        COALESCE(rp.department_ids, ARRAY[]::text[]) AS department_ids,
        COALESCE(rp.persona_ids, ARRAY[]::text[]) AS persona_ids,
        COALESCE(rp.document_ids, ARRAY[]::text[]) AS document_ids,
        COALESCE(rp.template_document_ids, ARRAY[]::text[]) AS template_document_ids,
        COALESCE(foi.objective_ids, ARRAY[]::text[]) AS objective_ids,
        COALESCE(pp.parameter_item_ids, ARRAY[]::text[]) AS parameter_item_ids,
        COALESCE(uip.upload_images, ARRAY[]::types.q_update_scenario_v4_upload_image[]) AS upload_images,
        rp.scenario_agent_id AS scenario_agent_id,
        rp.image_agent_id AS image_agent_id,
        COALESCE(pp.parameter_ids, ARRAY[]::text[]) AS parameter_ids,
        COALESCE(rp.video_ids, ARRAY[]::text[]) AS video_ids,
        rp.active_video_id AS active_video_id,
        COALESCE(rp.question_ids, ARRAY[]::text[]) AS question_ids,
        COALESCE(rp.question_timestamps, ARRAY[]::types.q_update_scenario_v4_question_timestamp[]) AS question_timestamps,
        rp.profile_id AS profile_id
    FROM raw_params rp
    CROSS JOIN filtered_objective_ids foi
    CROSS JOIN parameter_preprocessing pp
    CROSS JOIN upload_images_preprocessing uip
),
user_profile AS (
    SELECT 
        p.role,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
object_current_departments AS (
    -- Get scenario's current active department links
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM scenario_departments
    WHERE scenario_id = (SELECT scenario_id FROM params) AND active = true
),
user_departments AS (
    -- Get user's departments
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM profile_departments
    WHERE profile_id = (SELECT profile_id FROM params) AND active = true
),
validate_update_permissions AS (
    -- Validate department permissions for update operation
    SELECT validate_department_update_permissions(
        up.role::text,
        ocd.department_ids,
        ud.department_ids
    ) as validation_passed
    FROM user_profile up
    CROSS JOIN object_current_departments ocd
    CROSS JOIN user_departments ud
),
actor_profile AS (
    SELECT 
        (SELECT profile_id FROM params) as resolved_profile_id,
        up.actor_name
    FROM user_profile up
),
scenario_exists_check AS (
    -- Check if scenario exists
    SELECT EXISTS(
        SELECT 1 FROM scenarios WHERE id = (SELECT scenario_id FROM params)
    )::boolean as scenario_exists
),
scenario_exists AS (
    -- Get scenario info if exists
    SELECT id, name
    FROM scenarios
    WHERE id = (SELECT scenario_id FROM params)
),
update_scenario AS (
    -- Update scenario basic fields
    UPDATE scenarios
    SET 
        name = (SELECT name FROM params),
        description = (SELECT description FROM params),
        active = (SELECT active FROM params),
        objectives_enabled = (SELECT objectives_enabled FROM params),
        images_enabled = (SELECT images_enabled FROM params),
        video_enabled = (SELECT video_enabled FROM params),
        questions_enabled = (SELECT questions_enabled FROM params),
        problem_statement_enabled = (SELECT problem_statement_enabled FROM params),
        video_agent_id = COALESCE((SELECT video_agent_id FROM params), video_agent_id),
        scenario_agent_id = COALESCE((SELECT scenario_agent_id FROM params), scenario_agent_id),
        image_agent_id = COALESCE((SELECT image_agent_id FROM params), image_agent_id),
        updated_at = NOW()
    WHERE id IN (SELECT id FROM scenario_exists)
    RETURNING id as scenario_id, name
),
deactivate_problem_statements AS (
    -- Deactivate all existing problem statement links (preserve history)
    UPDATE scenario_problem_statements
    SET active = false, updated_at = NOW()
    WHERE scenario_id = (SELECT scenario_id FROM params) AND active = true
    RETURNING problem_statement_id
),
create_problem_statement AS (
    -- Create new problem_statement record (strong entity)
    INSERT INTO problem_statements (name, problem_statement, created_at, updated_at)
    SELECT 
        (SELECT problem_statement_name FROM params) as name,
        (SELECT problem_statement FROM params),
        NOW(),
        NOW()
    WHERE EXISTS (SELECT 1 FROM scenario_exists) 
      AND (SELECT problem_statement_name FROM params) IS NOT NULL 
      AND (SELECT problem_statement_name FROM params) != ''
    RETURNING id as problem_statement_id
),
link_problem_statement AS (
    -- Link new problem statement to scenario via junction table
    INSERT INTO scenario_problem_statements (scenario_id, problem_statement_id, active, created_at, updated_at)
    SELECT 
        (SELECT scenario_id FROM params),
        cps.problem_statement_id,
        true,
        NOW(),
        NOW()
    FROM create_problem_statement cps
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
),
replace_departments AS (
    -- Delete all existing department links
    DELETE FROM scenario_departments 
    WHERE scenario_id = (SELECT scenario_id FROM params)
),
insert_departments AS (
    -- Insert new department links
    INSERT INTO scenario_departments (scenario_id, department_id, active, created_at, updated_at)
    SELECT 
        (SELECT scenario_id FROM params),
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST((SELECT department_ids FROM params)) as dept_id
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND COALESCE(array_length((SELECT department_ids FROM params), 1), 0) > 0
    ON CONFLICT (scenario_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_personas AS (
    -- Delete all existing persona links
    DELETE FROM scenario_personas 
    WHERE scenario_id = (SELECT scenario_id FROM params)
),
insert_personas AS (
    -- Insert new persona links
    INSERT INTO scenario_personas (scenario_id, persona_id, active, created_at, updated_at)
    SELECT 
        (SELECT scenario_id FROM params),
        persona_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST((SELECT persona_ids FROM params)) as persona_id
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND COALESCE(array_length((SELECT persona_ids FROM params), 1), 0) > 0
    ON CONFLICT (scenario_id, persona_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_documents AS (
    -- Delete all existing document links
    DELETE FROM scenario_documents 
    WHERE scenario_id = (SELECT scenario_id FROM params)
),
insert_documents AS (
    -- Insert new document links (both regular and template documents)
    INSERT INTO scenario_documents (scenario_id, document_id, active, created_at, updated_at)
    SELECT 
        (SELECT scenario_id FROM params),
        doc_id::uuid,
        true,
        NOW(),
        NOW()
    FROM (
        SELECT doc_id FROM UNNEST((SELECT document_ids FROM params)) as doc_id
        UNION ALL
        SELECT doc_id FROM UNNEST((SELECT template_document_ids FROM params)) as doc_id
    ) all_docs
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND (COALESCE(array_length((SELECT document_ids FROM params), 1), 0) > 0 
           OR COALESCE(array_length((SELECT template_document_ids FROM params), 1), 0) > 0)
    ON CONFLICT (scenario_id, document_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_objectives AS (
    -- Delete all existing objective links
    DELETE FROM scenario_objectives 
    WHERE scenario_id = (SELECT scenario_id FROM params)
),
objectives_with_index AS (
    -- Prepare objectives with their index
    SELECT 
        obj_text,
        ROW_NUMBER() OVER () - 1 as idx
    FROM UNNEST((SELECT objective_ids FROM params)) as obj_text
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND COALESCE(array_length((SELECT objective_ids FROM params), 1), 0) > 0
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
insert_objectives AS (
    -- Link objectives to scenario via junction table
    INSERT INTO scenario_objectives (scenario_id, objective_id, idx, created_at)
    SELECT 
        (SELECT scenario_id FROM params),
        ao.objective_id,
        owi.idx,
        NOW()
    FROM objectives_with_index owi
    JOIN all_objectives ao ON ao.objective = owi.obj_text
),
replace_parameters AS (
    -- Delete all existing field links
    DELETE FROM scenario_fields 
    WHERE scenario_id = (SELECT scenario_id FROM params)
),
insert_parameters AS (
    -- Insert new field links
    INSERT INTO scenario_fields (scenario_id, field_id, active, created_at, updated_at)
    SELECT 
        (SELECT scenario_id FROM params),
        field_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST((SELECT parameter_item_ids FROM params)) as field_id
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND COALESCE(array_length((SELECT parameter_item_ids FROM params), 1), 0) > 0
    ON CONFLICT (scenario_id, field_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
delete_old_images AS (
    -- Delete old scenario image links (junction table entries)
    DELETE FROM scenario_images
    WHERE scenario_id = (SELECT scenario_id FROM params)
),
create_images AS (
    -- Create images if they don't exist
    INSERT INTO images (name, created_at, updated_at, active)
    SELECT DISTINCT
        img.name,
        NOW(),
        NOW(),
        true
    FROM params x
    CROSS JOIN UNNEST(x.upload_images) as img
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND array_length((SELECT upload_images FROM params), 1) > 0
      AND NOT EXISTS (
          SELECT 1 FROM images i
          JOIN image_uploads iu ON iu.image_id = i.id
          WHERE iu.upload_id = img.upload_id AND i.name = img.name
      )
    RETURNING id as image_id
),
link_image_uploads AS (
    -- Link images to uploads via junction table
    INSERT INTO image_uploads (image_id, upload_id, active, created_at, updated_at)
    SELECT DISTINCT
        ci.image_id,
        img.upload_id,
        true,
        NOW(),
        NOW()
    FROM create_images ci
    CROSS JOIN params x
    CROSS JOIN UNNEST(x.upload_images) as img
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND array_length((SELECT upload_images FROM params), 1) > 0
    ON CONFLICT (image_id, upload_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
get_images AS (
    -- Get existing images via image_uploads junction table
    SELECT i.id as image_id
    FROM params x
    CROSS JOIN UNNEST(x.upload_images) as img
    JOIN image_uploads iu ON iu.upload_id = img.upload_id
    JOIN images i ON i.id = iu.image_id AND i.name = img.name
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND iu.active = true
),
all_images AS (
    SELECT image_id FROM create_images
    UNION
    SELECT image_id FROM get_images
),
link_images AS (
    -- Link images to scenario via junction table
    INSERT INTO scenario_images (scenario_id, image_id, active, created_at, updated_at)
    SELECT 
        (SELECT scenario_id FROM params),
        ai.image_id,
        true,
        NOW(),
        NOW()
    FROM all_images ai
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND array_length((SELECT upload_images FROM params), 1) > 0
    ON CONFLICT (scenario_id, image_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
deactivate_scenario_parameters AS (
    -- Soft-delete removed parameters (set active = false for parameters not in new list)
    UPDATE scenario_parameters
    SET active = false, updated_at = NOW()
    WHERE scenario_id = (SELECT scenario_id FROM params)
    AND active = true
    AND (
        COALESCE(array_length((SELECT parameter_ids FROM params), 1), 0) = 0
        OR parameter_id NOT IN (SELECT unnest((SELECT parameter_ids FROM params))::uuid)
    )
),
link_scenario_parameters AS (
    -- Insert or reactivate parameter links if provided (array is never NULL, but may be empty)
    INSERT INTO scenario_parameters (scenario_id, parameter_id, active, created_at, updated_at)
    SELECT 
        (SELECT scenario_id FROM params),
        param_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST((SELECT parameter_ids FROM params)) as param_id
    WHERE COALESCE(array_length((SELECT parameter_ids FROM params), 1), 0) > 0
    ON CONFLICT (scenario_id, parameter_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
-- Update department links for content items based on scenario's departments
-- Get all content items currently linked to this scenario (after all updates)
scenario_content_images AS (
    SELECT DISTINCT image_id
    FROM scenario_images
    WHERE scenario_id = (SELECT scenario_id FROM params)
),
scenario_content_objectives AS (
    SELECT DISTINCT objective_id
    FROM scenario_objectives
    WHERE scenario_id = (SELECT scenario_id FROM params)
),
scenario_content_problem_statements AS (
    SELECT DISTINCT problem_statement_id
    FROM scenario_problem_statements
    WHERE scenario_id = (SELECT scenario_id FROM params) AND active = true
),
scenario_content_videos AS (
    SELECT DISTINCT video_id
    FROM scenario_videos
    WHERE scenario_id = (SELECT scenario_id FROM params)
),
scenario_content_questions AS (
    SELECT DISTINCT question_id
    FROM scenario_questions
    WHERE scenario_id = (SELECT scenario_id FROM params) AND active = true
),
-- Replace department links for images
replace_image_departments AS (
    DELETE FROM image_departments
    WHERE image_id IN (SELECT image_id FROM scenario_content_images)
),
link_image_departments AS (
    INSERT INTO image_departments (image_id, department_id, active, created_at, updated_at)
    SELECT DISTINCT
        sci.image_id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM scenario_content_images sci
    CROSS JOIN UNNEST((SELECT department_ids FROM params)) as dept_id
    WHERE COALESCE(array_length((SELECT department_ids FROM params), 1), 0) > 0
    ON CONFLICT (image_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
-- Replace department links for videos
replace_video_departments AS (
    DELETE FROM video_departments
    WHERE video_id IN (SELECT video_id FROM scenario_content_videos)
),
link_video_departments AS (
    INSERT INTO video_departments (video_id, department_id, active, created_at, updated_at)
    SELECT DISTINCT
        scv.video_id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM scenario_content_videos scv
    CROSS JOIN UNNEST((SELECT department_ids FROM params)) as dept_id
    WHERE COALESCE(array_length((SELECT department_ids FROM params), 1), 0) > 0
    ON CONFLICT (video_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
-- Replace department links for objectives
replace_objective_departments AS (
    DELETE FROM objective_departments
    WHERE objective_id IN (SELECT objective_id FROM scenario_content_objectives)
),
link_objective_departments AS (
    INSERT INTO objective_departments (objective_id, department_id, active, created_at, updated_at)
    SELECT DISTINCT
        sco.objective_id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM scenario_content_objectives sco
    CROSS JOIN UNNEST((SELECT department_ids FROM params)) as dept_id
    WHERE COALESCE(array_length((SELECT department_ids FROM params), 1), 0) > 0
    ON CONFLICT (objective_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
-- Replace department links for questions
replace_question_departments AS (
    DELETE FROM question_departments
    WHERE question_id IN (SELECT question_id FROM scenario_content_questions)
),
link_question_departments AS (
    INSERT INTO question_departments (question_id, department_id, active, created_at, updated_at)
    SELECT DISTINCT
        scq.question_id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM scenario_content_questions scq
    CROSS JOIN UNNEST((SELECT department_ids FROM params)) as dept_id
    WHERE COALESCE(array_length((SELECT department_ids FROM params), 1), 0) > 0
    ON CONFLICT (question_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
-- Replace department links for problem statements
replace_problem_statement_departments AS (
    DELETE FROM problem_statement_departments
    WHERE problem_statement_id IN (SELECT problem_statement_id FROM scenario_content_problem_statements)
),
link_problem_statement_departments AS (
    INSERT INTO problem_statement_departments (problem_statement_id, department_id, active, created_at, updated_at)
    SELECT DISTINCT
        scps.problem_statement_id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM scenario_content_problem_statements scps
    CROSS JOIN UNNEST((SELECT department_ids FROM params)) as dept_id
    WHERE COALESCE(array_length((SELECT department_ids FROM params), 1), 0) > 0
    ON CONFLICT (problem_statement_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
-- Update/create randomization ranges for scenario
-- Upsert persona ranges (create if not exists, update if exists)
upsert_persona_ranges AS (
    INSERT INTO scenario_persona_ranges (scenario_id, min_count, max_count)
    SELECT us.scenario_id, 1, 3
    FROM update_scenario us
    ON CONFLICT (scenario_id) DO UPDATE SET
        updated_at = NOW()
),
upsert_document_ranges AS (
    INSERT INTO scenario_document_ranges (scenario_id, min_count, max_count)
    SELECT us.scenario_id, 0, 3
    FROM update_scenario us
    ON CONFLICT (scenario_id) DO UPDATE SET
        updated_at = NOW()
),
upsert_parameter_ranges AS (
    INSERT INTO scenario_parameter_ranges (scenario_id, min_count, max_count)
    SELECT us.scenario_id, 0, 3
    FROM update_scenario us
    ON CONFLICT (scenario_id) DO UPDATE SET
        updated_at = NOW()
),
upsert_field_ranges AS (
    -- Upsert field ranges for each parameter linked to the scenario
    INSERT INTO scenario_field_ranges (scenario_id, parameter_id, min_count, max_count)
    SELECT 
        us.scenario_id,
        param_id::uuid,
        1,  -- default min
        3   -- default max
    FROM update_scenario us
    CROSS JOIN UNNEST((SELECT parameter_ids FROM params)) as param_id
    WHERE COALESCE(array_length((SELECT parameter_ids FROM params), 1), 0) > 0
    ON CONFLICT (scenario_id, parameter_id) DO UPDATE SET
        updated_at = NOW()
)
SELECT 
    sec.scenario_exists::boolean as scenario_exists,
    us.scenario_id::uuid as scenario_id,
    us.name::text as name,
    ap.actor_name::text as actor_name
FROM scenario_exists_check sec
LEFT JOIN update_scenario us ON sec.scenario_exists = true
CROSS JOIN actor_profile ap
$$;