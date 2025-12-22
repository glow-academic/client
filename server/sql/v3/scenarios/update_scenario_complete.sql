-- Update scenario with all relationships in a single transaction
-- Parameters: $1=scenarioId, $2=name, $3=description, $4=active, $5=objectives_enabled,
--            $6=images_enabled, $7=video_enabled, $8=questions_enabled, $9=problem_statement_enabled, $10=video_agent_id (uuid, nullable),
--            $11=problem_statement (text), $12=problem_statement_name (text, nullable - defaults to scenario name),
--            $13=department_ids (text array, nullable), $14=persona_ids (text array, nullable),
--            $15=document_ids (text array), $16=template_document_ids (text array, nullable), $17=objective_ids (text array),
--            $18=parameter_item_ids (text array, flattened from parameters dict),
--            $19=upload_images_json (JSONB string with upload images array), $20=scenario_agent_id (nullable uuid), $21=image_agent_id (nullable uuid),
--            $22=parameter_ids (text array, nullable), $23=profile_id (uuid, required)
-- Upload images JSON structure: [{"upload_id": "...", "name": "..."}]
-- Returns: scenario_id, name, actor_name if updated, or no rows if scenario doesn't exist
-- Note: objective_ids should only contain new objective text (composite IDs filtered in Python)
-- profile_id is always a UUID (required in request body)
WITH user_profile AS (
    SELECT 
        p.role,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM profiles p
    WHERE p.id = $23::uuid
),
object_current_departments AS (
    -- Get scenario's current active department links
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM scenario_departments
    WHERE scenario_id = $1::uuid AND active = true
),
user_departments AS (
    -- Get user's departments
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM profile_departments
    WHERE profile_id = $23::uuid AND active = true
),
validate_update_permissions AS (
    -- Validate department permissions for update operation
    SELECT validate_department_update_permissions(
        up.role,
        ocd.department_ids,
        ud.department_ids
    ) as validation_passed
    FROM user_profile up
    CROSS JOIN object_current_departments ocd
    CROSS JOIN user_departments ud
),
actor_profile AS (
    SELECT 
        $23::uuid as resolved_profile_id,
        up.actor_name
    FROM user_profile up
),
scenario_exists AS (
    -- Check if scenario exists
    SELECT id, name
    FROM scenarios
    WHERE id = $1::uuid
),
update_scenario AS (
    -- Update scenario basic fields
    UPDATE scenarios
    SET 
        name = $2,
        description = COALESCE($3, ''),
        active = $4,
        objectives_enabled = $5,
        images_enabled = $6,
        video_enabled = $7,
        questions_enabled = $8,
        problem_statement_enabled = $9,
        video_agent_id = COALESCE($10::uuid, video_agent_id),
        scenario_agent_id = COALESCE($20::uuid, scenario_agent_id),
        image_agent_id = COALESCE($21::uuid, image_agent_id),
        updated_at = NOW()
    WHERE id IN (SELECT id FROM scenario_exists)
    RETURNING id::text as scenario_id, name
),
deactivate_problem_statements AS (
    -- Deactivate all existing problem statement links (preserve history)
    UPDATE scenario_problem_statements
    SET active = false, updated_at = NOW()
    WHERE scenario_id = $1::uuid AND active = true
    RETURNING problem_statement_id
),
create_problem_statement AS (
    -- Create new problem_statement record (strong entity)
    INSERT INTO problem_statements (name, problem_statement, created_at, updated_at)
    SELECT 
        COALESCE($12::text, $2::text) as name,  -- Use provided name or scenario name
        $11::text,
        NOW(),
        NOW()
    WHERE EXISTS (SELECT 1 FROM scenario_exists) 
      AND $12::text IS NOT NULL 
      AND $12::text != ''
    RETURNING id as problem_statement_id
),
link_problem_statement AS (
    -- Link new problem statement to scenario via junction table
    INSERT INTO scenario_problem_statements (scenario_id, problem_statement_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
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
    WHERE scenario_id = $1::uuid
),
insert_departments AS (
    -- Insert new department links
    INSERT INTO scenario_departments (scenario_id, department_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($13::text[]) as dept_id
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND COALESCE(array_length($13::text[], 1), 0) > 0
    ON CONFLICT (scenario_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_personas AS (
    -- Delete all existing persona links
    DELETE FROM scenario_personas 
    WHERE scenario_id = $1::uuid
),
insert_personas AS (
    -- Insert new persona links
    INSERT INTO scenario_personas (scenario_id, persona_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        persona_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($14::text[]) as persona_id
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND COALESCE(array_length($14::text[], 1), 0) > 0
    ON CONFLICT (scenario_id, persona_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_documents AS (
    -- Delete all existing document links
    DELETE FROM scenario_documents 
    WHERE scenario_id = $1::uuid
),
insert_documents AS (
    -- Insert new document links (both regular and template documents)
    INSERT INTO scenario_documents (scenario_id, document_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        doc_id::uuid,
        true,
        NOW(),
        NOW()
    FROM (
        SELECT doc_id FROM UNNEST($15::text[]) as doc_id
        UNION ALL
        SELECT doc_id FROM UNNEST(COALESCE($16::text[], ARRAY[]::text[])) as doc_id
    ) all_docs
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND (COALESCE(array_length($15::text[], 1), 0) > 0 
           OR COALESCE(array_length($16::text[], 1), 0) > 0)
    ON CONFLICT (scenario_id, document_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_objectives AS (
    -- Delete all existing objective links
    DELETE FROM scenario_objectives 
    WHERE scenario_id = $1::uuid
),
objectives_with_index AS (
    -- Prepare objectives with their index
    SELECT 
        obj_text,
        ROW_NUMBER() OVER () - 1 as idx
    FROM UNNEST($17::text[]) as obj_text
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND COALESCE(array_length($17::text[], 1), 0) > 0
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
        $1::uuid,
        ao.objective_id,
        owi.idx,
        NOW()
    FROM objectives_with_index owi
    JOIN all_objectives ao ON ao.objective = owi.obj_text
),
replace_parameters AS (
    -- Delete all existing field links
    DELETE FROM scenario_fields 
    WHERE scenario_id = $1::uuid
),
insert_parameters AS (
    -- Insert new field links
    INSERT INTO scenario_fields (scenario_id, field_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        field_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($18::text[]) as field_id
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND COALESCE(array_length($18::text[], 1), 0) > 0
    ON CONFLICT (scenario_id, field_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
delete_old_images AS (
    -- Delete old scenario image links (junction table entries)
    DELETE FROM scenario_images
    WHERE scenario_id = $1::uuid
),
create_images AS (
    -- Create images if they don't exist
    INSERT INTO images (name, created_at, updated_at, active)
    SELECT DISTINCT
        img->>'name',
        NOW(),
        NOW(),
        true
    FROM jsonb_array_elements(COALESCE($19::jsonb, '[]'::jsonb)) as img
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND jsonb_array_length(COALESCE($19::jsonb, '[]'::jsonb)) > 0
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
    CROSS JOIN jsonb_array_elements(COALESCE($19::jsonb, '[]'::jsonb)) as img
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND jsonb_array_length(COALESCE($19::jsonb, '[]'::jsonb)) > 0
    ON CONFLICT (image_id, upload_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
get_images AS (
    -- Get existing images via image_uploads junction table
    SELECT i.id as image_id
    FROM jsonb_array_elements(COALESCE($19::jsonb, '[]'::jsonb)) as img
    JOIN image_uploads iu ON iu.upload_id = (img->>'upload_id')::uuid
    JOIN images i ON i.id = iu.image_id AND i.name = img->>'name'
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
        $1::uuid,
        ai.image_id,
        true,
        NOW(),
        NOW()
    FROM all_images ai
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND jsonb_array_length(COALESCE($19::jsonb, '[]'::jsonb)) > 0
    ON CONFLICT (scenario_id, image_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
deactivate_scenario_parameters AS (
    -- Soft-delete removed parameters (set active = false for parameters not in new list)
    UPDATE scenario_parameters
    SET active = false, updated_at = NOW()
    WHERE scenario_id = $1::uuid
    AND active = true
    AND (
        COALESCE(array_length($22::text[], 1), 0) = 0
        OR parameter_id NOT IN (SELECT unnest($22::text[])::uuid)
    )
),
link_scenario_parameters AS (
    -- Insert or reactivate parameter links if provided (array is never NULL, but may be empty)
    INSERT INTO scenario_parameters (scenario_id, parameter_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        param_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($22::text[]) as param_id
    WHERE COALESCE(array_length($22::text[], 1), 0) > 0
    ON CONFLICT (scenario_id, parameter_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
-- Update department links for content items based on scenario's departments
-- Get all content items currently linked to this scenario (after all updates)
scenario_content_images AS (
    SELECT DISTINCT image_id
    FROM scenario_images
    WHERE scenario_id = $1::uuid
),
scenario_content_objectives AS (
    SELECT DISTINCT objective_id
    FROM scenario_objectives
    WHERE scenario_id = $1::uuid
),
scenario_content_problem_statements AS (
    SELECT DISTINCT problem_statement_id
    FROM scenario_problem_statements
    WHERE scenario_id = $1::uuid AND active = true
),
scenario_content_videos AS (
    SELECT DISTINCT video_id
    FROM scenario_videos
    WHERE scenario_id = $1::uuid
),
scenario_content_questions AS (
    SELECT DISTINCT question_id
    FROM scenario_questions
    WHERE scenario_id = $1::uuid AND active = true
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
    CROSS JOIN UNNEST($13::text[]) as dept_id
    WHERE COALESCE(array_length($13::text[], 1), 0) > 0
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
    CROSS JOIN UNNEST($13::text[]) as dept_id
    WHERE COALESCE(array_length($13::text[], 1), 0) > 0
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
    CROSS JOIN UNNEST($13::text[]) as dept_id
    WHERE COALESCE(array_length($13::text[], 1), 0) > 0
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
    CROSS JOIN UNNEST($13::text[]) as dept_id
    WHERE COALESCE(array_length($13::text[], 1), 0) > 0
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
    CROSS JOIN UNNEST($13::text[]) as dept_id
    WHERE COALESCE(array_length($13::text[], 1), 0) > 0
    ON CONFLICT (problem_statement_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
-- Update/create randomization ranges for scenario
-- Upsert persona ranges (create if not exists, update if exists)
upsert_persona_ranges AS (
    INSERT INTO scenario_persona_ranges (scenario_id, min_count, max_count)
    SELECT us.scenario_id::uuid, 1, 3
    FROM update_scenario us
    ON CONFLICT (scenario_id) DO UPDATE SET
        updated_at = NOW()
),
upsert_document_ranges AS (
    INSERT INTO scenario_document_ranges (scenario_id, min_count, max_count)
    SELECT us.scenario_id::uuid, 0, 3
    FROM update_scenario us
    ON CONFLICT (scenario_id) DO UPDATE SET
        updated_at = NOW()
),
upsert_parameter_ranges AS (
    INSERT INTO scenario_parameter_ranges (scenario_id, min_count, max_count)
    SELECT us.scenario_id::uuid, 0, 3
    FROM update_scenario us
    ON CONFLICT (scenario_id) DO UPDATE SET
        updated_at = NOW()
),
upsert_field_ranges AS (
    -- Upsert field ranges for each parameter linked to the scenario
    INSERT INTO scenario_field_ranges (scenario_id, parameter_id, min_count, max_count)
    SELECT 
        us.scenario_id::uuid,
        param_id::uuid,
        1,  -- default min
        3   -- default max
    FROM update_scenario us
    CROSS JOIN UNNEST($22::text[]) as param_id
    WHERE COALESCE(array_length($22::text[], 1), 0) > 0
    ON CONFLICT (scenario_id, parameter_id) DO UPDATE SET
        updated_at = NOW()
)
SELECT 
    us.scenario_id,
    us.name,
    ap.actor_name
FROM update_scenario us
CROSS JOIN actor_profile ap

