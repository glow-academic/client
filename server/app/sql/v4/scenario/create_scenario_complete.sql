-- Create scenario with all relationships in a single transaction
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
        WHERE proname = 'api_create_scenario_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_scenario_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_create_scenario_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_create_scenario_v4_parameter AS (
    parameter_id uuid,
    field_ids uuid[]
);

CREATE TYPE types.q_create_scenario_v4_question_timestamp AS (
    question_id uuid,
    video_id uuid,
    timestamps numeric[]
);

CREATE TYPE types.q_create_scenario_v4_upload_image AS (
    upload_id uuid,
    name text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_create_scenario_v4(
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
    parameters types.q_create_scenario_v4_parameter[],
    profile_id uuid,
    description text DEFAULT NULL,
    video_domain_id uuid DEFAULT NULL,
    problem_statement_name text DEFAULT NULL,
    problem_statement_versions text[] DEFAULT NULL,
    department_ids text[] DEFAULT NULL,
    persona_ids text[] DEFAULT NULL,
    template_document_ids text[] DEFAULT NULL,
    upload_ids uuid[] DEFAULT NULL,
    image_names text[] DEFAULT NULL,
    video_ids text[] DEFAULT NULL,
    active_video_id text DEFAULT NULL,
    question_ids text[] DEFAULT NULL,
    question_timestamps types.q_create_scenario_v4_question_timestamp[] DEFAULT ARRAY[]::types.q_create_scenario_v4_question_timestamp[],
    run_id uuid DEFAULT NULL
)
RETURNS TABLE (
    scenario_id uuid,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH raw_params AS (
    SELECT
        name AS name,
        description AS description,
        active AS active,
        objectives_enabled AS objectives_enabled,
        images_enabled AS images_enabled,
        video_enabled AS video_enabled,
        questions_enabled AS questions_enabled,
        problem_statement_enabled AS problem_statement_enabled,
        video_domain_id AS video_domain_id,
        problem_statement AS problem_statement,
        problem_statement_name AS problem_statement_name,
        problem_statement_versions AS problem_statement_versions,
        department_ids AS department_ids,
        persona_ids AS persona_ids,
        document_ids AS document_ids,
        template_document_ids AS template_document_ids,
        objective_ids AS objective_ids,
        parameters AS parameters,
        upload_ids AS upload_ids,
        image_names AS image_names,
        video_ids AS video_ids,
        active_video_id AS active_video_id,
        question_ids AS question_ids,
        question_timestamps AS question_timestamps,
        run_id AS run_id,
        profile_id AS profile_id
),
-- Preprocessing: Filter composite objective IDs (those with "_" and length 2 when split)
filtered_objective_ids AS (
    SELECT ARRAY_AGG(obj_id) FILTER (WHERE obj_id IS NOT NULL) as objective_ids
    FROM raw_params rp
    CROSS JOIN UNNEST(COALESCE(rp.objective_ids, ARRAY[]::text[])) as obj_id
    WHERE NOT (obj_id LIKE '%_%' AND array_length(string_to_array(obj_id, '_'), 1) = 2)
),
-- Preprocessing: Extract parameter_item_ids and parameter_ids FROM parameter_artifact composite type array
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
    CROSS JOIN UNNEST(COALESCE(rp.parameters, ARRAY[]::types.q_create_scenario_v4_parameter[])) as param
    CROSS JOIN UNNEST(COALESCE(param.field_ids, ARRAY[]::uuid[])) as field_id
),
-- Preprocessing: Process problem statement versions (clean, deduplicate, ensure problem_statement included)
processed_problem_statement_versions AS (
    SELECT 
        CASE 
            WHEN rp.problem_statement_versions IS NOT NULL 
                 AND array_length(rp.problem_statement_versions, 1) > 0
            THEN 
                -- Clean and deduplicate versions, ensure problem_statement is included
                COALESCE(
                    ARRAY_AGG(DISTINCT version_text) FILTER (WHERE version_text IS NOT NULL AND version_text != ''),
                    ARRAY[]::text[]
                )
            ELSE 
                -- If no versions provided, use single problem statement if available
                CASE 
                    WHEN rp.problem_statement IS NOT NULL AND rp.problem_statement != ''
                    THEN ARRAY[rp.problem_statement]
                    ELSE ARRAY[]::text[]
                END
        END as problem_statement_versions
    FROM raw_params rp
    CROSS JOIN LATERAL (
        SELECT version_text
        FROM UNNEST(COALESCE(rp.problem_statement_versions, ARRAY[]::text[])) as version_text
        WHERE version_text IS NOT NULL AND trim(version_text) != ''
        UNION ALL
        -- Ensure problem_statement is included if not already in versions
        SELECT rp.problem_statement as version_text
        WHERE rp.problem_statement IS NOT NULL 
          AND rp.problem_statement != ''
          AND (rp.problem_statement_versions IS NULL 
               OR NOT (rp.problem_statement = ANY(rp.problem_statement_versions)))
    ) all_versions
    GROUP BY rp.problem_statement_versions, rp.problem_statement
),
-- Preprocessing: Construct upload_images array from upload_ids and image_names arrays
upload_images_preprocessing AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (upload_id, image_name)::types.q_create_scenario_v4_upload_image
                ORDER BY idx
            ),
            '{}'::types.q_create_scenario_v4_upload_image[]
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
        rp.name AS name,
        COALESCE(NULLIF(rp.description, ''), '') AS description,
        rp.active AS active,
        rp.objectives_enabled AS objectives_enabled,
        rp.images_enabled AS images_enabled,
        rp.video_enabled AS video_enabled,
        rp.questions_enabled AS questions_enabled,
        rp.problem_statement_enabled AS problem_statement_enabled,
        rp.video_domain_id AS video_domain_id,
        rp.problem_statement AS problem_statement,
        COALESCE(rp.problem_statement_name, rp.name) AS problem_statement_name,
        COALESCE(ppsv.problem_statement_versions, ARRAY[]::text[]) AS problem_statement_versions,
        COALESCE(rp.department_ids, ARRAY[]::text[]) AS department_ids,
        COALESCE(rp.persona_ids, ARRAY[]::text[]) AS persona_ids,
        COALESCE(rp.document_ids, ARRAY[]::text[]) AS document_ids,
        COALESCE(rp.template_document_ids, ARRAY[]::text[]) AS template_document_ids,
        COALESCE(foi.objective_ids, ARRAY[]::text[]) AS objective_ids,
        COALESCE(pp.parameter_item_ids, ARRAY[]::text[]) AS parameter_item_ids,
        COALESCE(uip.upload_images, ARRAY[]::types.q_create_scenario_v4_upload_image[]) AS upload_images,
        COALESCE(rp.video_ids, ARRAY[]::text[]) AS video_ids,
        rp.active_video_id AS active_video_id,
        COALESCE(rp.question_ids, ARRAY[]::text[]) AS question_ids,
        COALESCE(rp.question_timestamps, ARRAY[]::types.q_create_scenario_v4_question_timestamp[]) AS question_timestamps,
        rp.run_id AS run_id,
        COALESCE(pp.parameter_ids, ARRAY[]::text[]) AS parameter_ids,
        rp.profile_id AS profile_id
    FROM raw_params rp
    CROSS JOIN filtered_objective_ids foi
    CROSS JOIN parameter_preprocessing pp
    CROSS JOIN processed_problem_statement_versions ppsv
    CROSS JOIN upload_images_preprocessing uip
),
user_profile AS (
    SELECT 
        p.role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
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
get_or_create_name AS (
    -- Get or create name in names table
    INSERT INTO names_resource (name, created_at, updated_at)
    SELECT (SELECT name FROM params), NOW(), NOW()
    WHERE (SELECT name FROM params) IS NOT NULL AND (SELECT name FROM params) != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id, name as name_value
),
get_or_create_description AS (
    -- Get or create description in descriptions table
    INSERT INTO descriptions_resource (description, created_at, updated_at)
    SELECT (SELECT description FROM params), NOW(), NOW()
    WHERE (SELECT description FROM params) IS NOT NULL AND (SELECT description FROM params) != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
get_flag_ids AS (
    -- Get flag IDs for all scenario flags
    SELECT 
        (SELECT id FROM flags_resource WHERE name = 'active' LIMIT 1) as active_flag_id,
        (SELECT id FROM flags_resource WHERE name = 'objectives_enabled' LIMIT 1) as objectives_enabled_flag_id,
        (SELECT id FROM flags_resource WHERE name = 'images_enabled' LIMIT 1) as images_enabled_flag_id,
        (SELECT id FROM flags_resource WHERE name = 'video_enabled' LIMIT 1) as video_enabled_flag_id,
        (SELECT id FROM flags_resource WHERE name = 'questions_enabled' LIMIT 1) as questions_enabled_flag_id,
        (SELECT id FROM flags_resource WHERE name = 'problem_statement_enabled' LIMIT 1) as problem_statement_enabled_flag_id
),
new_scenario AS (
    INSERT INTO scenario_artifact (
        created_at,
        updated_at
    )
    SELECT 
        NOW(),
        NOW()
    FROM params
    RETURNING id
),
link_name AS (
    -- Link name to scenario
    INSERT INTO scenario_names (scenario_id, name_id, created_at, updated_at)
    SELECT ns.id, gocn.name_id, NOW(), NOW()
    FROM new_scenario ns
    CROSS JOIN get_or_create_name gocn
    WHERE gocn.name_id IS NOT NULL
),
link_description AS (
    -- Link description to scenario (if provided)
    INSERT INTO scenario_descriptions (scenario_id, description_id, created_at, updated_at)
    SELECT ns.id, gocd.description_id, NOW(), NOW()
    FROM new_scenario ns
    CROSS JOIN get_or_create_description gocd
    WHERE gocd.description_id IS NOT NULL
),
link_flags AS (
    -- Link all scenario flags
    INSERT INTO scenario_flags (scenario_id, flag_id, type, value, created_at, updated_at)
    SELECT ns.id, gfi.active_flag_id, 'active'::type_scenario_flags, p.active, NOW(), NOW()
    FROM new_scenario ns
    CROSS JOIN get_flag_ids gfi
    CROSS JOIN params p
    WHERE p.active IS NOT NULL
    UNION ALL
    SELECT ns.id, gfi.objectives_enabled_flag_id, 'objectives_enabled'::type_scenario_flags, p.objectives_enabled, NOW(), NOW()
    FROM new_scenario ns
    CROSS JOIN get_flag_ids gfi
    CROSS JOIN params p
    WHERE p.objectives_enabled IS NOT NULL
    UNION ALL
    SELECT ns.id, gfi.images_enabled_flag_id, 'images_enabled'::type_scenario_flags, p.images_enabled, NOW(), NOW()
    FROM new_scenario ns
    CROSS JOIN get_flag_ids gfi
    CROSS JOIN params p
    WHERE p.images_enabled IS NOT NULL
    UNION ALL
    SELECT ns.id, gfi.video_enabled_flag_id, 'video_enabled'::type_scenario_flags, p.video_enabled, NOW(), NOW()
    FROM new_scenario ns
    CROSS JOIN get_flag_ids gfi
    CROSS JOIN params p
    WHERE p.video_enabled IS NOT NULL
    UNION ALL
    SELECT ns.id, gfi.questions_enabled_flag_id, 'questions_enabled'::type_scenario_flags, p.questions_enabled, NOW(), NOW()
    FROM new_scenario ns
    CROSS JOIN get_flag_ids gfi
    CROSS JOIN params p
    WHERE p.questions_enabled IS NOT NULL
    UNION ALL
    SELECT ns.id, gfi.problem_statement_enabled_flag_id, 'problem_statement_enabled'::type_scenario_flags, p.problem_statement_enabled, NOW(), NOW()
    FROM new_scenario ns
    CROSS JOIN get_flag_ids gfi
    CROSS JOIN params p
    WHERE p.problem_statement_enabled IS NOT NULL
),
-- Domain-based agent assignment removed - no longer needed
link_video_domain AS (
    -- Placeholder CTE (removed domain logic)
    SELECT NULL::uuid as dummy FROM new_scenario LIMIT 0
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
    INSERT INTO problem_statements_resource (name, problem_statement, created_at, updated_at)
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
    FROM objectives_resource
    WHERE objective = ANY(SELECT obj_text FROM objectives_with_index)
),
new_objectives AS (
    -- Create new objectives that don't exist yet
    INSERT INTO objectives_resource (objective, created_at, updated_at)
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
    INSERT INTO images_resource (name, created_at, updated_at, active)
    SELECT DISTINCT
        img.name,
        NOW(),
        NOW(),
        true
    FROM params x
    CROSS JOIN UNNEST(x.upload_images) as img
    WHERE array_length((SELECT upload_images FROM params), 1) > 0
      AND NOT EXISTS (
          SELECT 1 FROM images_resource i
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
    WHERE array_length((SELECT upload_images FROM params), 1) > 0
    ON CONFLICT (image_id, upload_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
    RETURNING image_id, upload_id
),
get_images AS (
    -- Get existing images via image_uploads junction table
    SELECT i.id as image_id, iu.upload_id
    FROM params x
    CROSS JOIN UNNEST(x.upload_images) as img
    JOIN image_uploads iu ON iu.upload_id = img.upload_id
    JOIN images_resource i ON i.id = iu.image_id AND i.name = img.name
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
    WHERE array_length((SELECT upload_images FROM params), 1) > 0
    ON CONFLICT (scenario_id, image_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_problem_statements_to_runs AS (
    -- Link problem statements to run via tool_call if run_id provided
    -- Note: Problem statements no longer have tool_call_id, so we can't verify the run relationship
    -- This CTE is kept for compatibility but doesn't perform verification
    SELECT DISTINCT
        cps.problem_statement_id,
        (SELECT run_id FROM params) as run_id
    FROM create_problem_statements cps
    WHERE (SELECT run_id FROM params) IS NOT NULL
),
link_objectives_to_runs AS (
    -- Link objectives to run via tool_call if run_id provided
    -- Note: Objectives no longer have tool_call_id, so we can't verify the run relationship
    -- This CTE is kept for compatibility but doesn't perform verification
    SELECT DISTINCT
        ao.objective_id,
        (SELECT run_id FROM params) as run_id
    FROM all_objectives ao
    WHERE (SELECT run_id FROM params) IS NOT NULL
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
update_question_times AS (
    -- Update question times directly on questions table (use first timestamp if multiple provided)
    UPDATE questions_resource q
    SET time = COALESCE(
        (SELECT (timestamps[1])::integer 
         FROM UNNEST((SELECT question_timestamps FROM params)) as qt
         WHERE qt.question_id = q.id
         AND array_length(qt.timestamps, 1) > 0
         LIMIT 1),
        q.time
    ),
    updated_at = NOW()
    WHERE EXISTS (
        SELECT 1 
        FROM UNNEST((SELECT question_timestamps FROM params)) as qt
        WHERE qt.question_id = q.id
        AND array_length(qt.timestamps, 1) > 0
    )
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