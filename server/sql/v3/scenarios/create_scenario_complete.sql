-- Create scenario with all relationships in a single transaction
-- Parameters: $1=name, $2=description, $3=active, $4=objectives_enabled, $5=images_enabled,
--            $6=video_enabled, $7=questions_enabled, $8=video_agent_id (uuid, nullable),
--            $9=problem_statement (text), $10=problem_statement_name (text, nullable - defaults to scenario name),
--            $11=problem_statement_versions (text array, nullable),
--            $12=department_ids (text array, nullable), $13=persona_ids (text array, nullable),
--            $14=document_ids (text array), $15=template_document_ids (text array, nullable), $16=objective_ids (text array), 
--            $17=parameter_item_ids (text array, flattened from parameters dict),
--            $18=upload_images_json (JSONB string with upload images array),
--            $19=video_ids (text array, nullable), $20=active_video_id (text, nullable - only one active),
--            $21=question_ids (text array, nullable), $22=question_timestamps (JSONB, nullable - maps question_id to video_id to times array),
--            $23=run_id (uuid, nullable - for linking AI-generated problem_statements and objectives to runs),
--            $24=parameter_ids (text array, nullable), $25=profile_id (uuid or "guest-profile-id")
-- Upload images JSON structure: [{"upload_id": "...", "name": "..."}]
-- Note: objective_ids should only contain new objective text (composite IDs like "scenarioId_idx" should be filtered out in Python)
-- Note: problem_statement_versions contains all versions; the one matching problem_statement should be active
-- Returns: scenario_id, actor_name
WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $25::uuid AND sdg.active = true
             LIMIT 1),
            -- Fallback to default (active) settings guest profile
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             WHERE sdg.active = true
             LIMIT 1)
        ) as guest_profile_id
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $25::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $25::text IS NULL OR $25::text = '' THEN NULL::uuid
            ELSE $25::uuid
        END as resolved_profile_id
),
actor_profile AS (
    SELECT 
        rpi.resolved_profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
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
        video_agent_id
    )
    VALUES ($1, COALESCE($2, ''), $3, $4, $5, $6, $7, $8)
    RETURNING id::text as scenario_id
),
link_departments AS (
    -- Link departments if provided
    INSERT INTO scenario_departments (scenario_id, department_id, active, created_at, updated_at)
    SELECT 
        ns.scenario_id::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN UNNEST($12::text[]) as dept_id
    WHERE COALESCE(array_length($12::text[], 1), 0) > 0
    ON CONFLICT (scenario_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_scenario_parameters AS (
    -- Link parameters if provided (array is never NULL, but may be empty)
    INSERT INTO scenario_parameters (scenario_id, parameter_id, active, created_at, updated_at)
    SELECT 
        ns.scenario_id::uuid,
        param_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN UNNEST($23::text[]) as param_id
    WHERE COALESCE(array_length($23::text[], 1), 0) > 0
    ON CONFLICT (scenario_id, parameter_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_tree_edge AS (
    -- Insert self-referencing edge in scenario_tree (marks as root)
    INSERT INTO scenario_tree (parent_id, child_id, active)
    SELECT ns.scenario_id::uuid, ns.scenario_id::uuid, true
    FROM new_scenario ns
),
problem_statement_versions_data AS (
    -- Prepare problem statement versions
    SELECT DISTINCT version_text
    FROM new_scenario ns
    CROSS JOIN UNNEST($11::text[]) as version_text
    WHERE COALESCE(array_length($11::text[], 1), 0) > 0
    UNION ALL
    -- If no versions provided, use single problem statement
    SELECT $9::text as version_text
    FROM new_scenario ns
    WHERE COALESCE(array_length($11::text[], 1), 0) = 0 AND $9::text IS NOT NULL AND $9::text != ''
),
create_problem_statements AS (
    -- Create problem_statement records first (strong entity)
    -- Always create new records (don't reuse) to allow different names for same text
    INSERT INTO problem_statements (name, problem_statement, created_at, updated_at)
    SELECT 
        COALESCE($10::text, $1::text) as name,  -- Use provided name or scenario name
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
        ns.scenario_id::uuid,
        cps.problem_statement_id,
        CASE 
            WHEN cps.problem_statement = $9 THEN true  -- Active if matches problem_statement
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
        ns.scenario_id::uuid,
        persona_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN UNNEST($13::text[]) as persona_id
    WHERE COALESCE(array_length($13::text[], 1), 0) > 0
    ON CONFLICT (scenario_id, persona_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_documents AS (
    -- Link documents (both regular and template documents)
    INSERT INTO scenario_documents (scenario_id, document_id, active, created_at, updated_at)
    SELECT 
        ns.scenario_id::uuid,
        doc_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN (
        SELECT doc_id FROM UNNEST($14::text[]) as doc_id
        UNION ALL
        SELECT doc_id FROM UNNEST(COALESCE($15::text[], ARRAY[]::text[])) as doc_id
    ) all_docs
    WHERE COALESCE(array_length($14::text[], 1), 0) > 0 
       OR COALESCE(array_length($15::text[], 1), 0) > 0
    ON CONFLICT (scenario_id, document_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
objectives_with_index AS (
    -- Prepare objectives with their index (skip composite IDs - filtered in Python)
    SELECT 
        obj_text,
        ROW_NUMBER() OVER () - 1 as idx
    FROM UNNEST($16::text[]) as obj_text
    WHERE COALESCE(array_length($16::text[], 1), 0) > 0
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
        ns.scenario_id::uuid,
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
        ns.scenario_id::uuid,
        field_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN UNNEST($17::text[]) as field_id
    WHERE COALESCE(array_length($17::text[], 1), 0) > 0
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
    FROM jsonb_array_elements(COALESCE($18::jsonb, '[]'::jsonb)) as img
    WHERE jsonb_array_length(COALESCE($18::jsonb, '[]'::jsonb)) > 0
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
    CROSS JOIN jsonb_array_elements(COALESCE($18::jsonb, '[]'::jsonb)) as img
    WHERE jsonb_array_length(COALESCE($18::jsonb, '[]'::jsonb)) > 0
    ON CONFLICT (image_id, upload_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
get_images AS (
    -- Get existing images via image_uploads junction table
    SELECT i.id as image_id, iu.upload_id
    FROM jsonb_array_elements(COALESCE($18::jsonb, '[]'::jsonb)) as img
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
        ns.scenario_id::uuid,
        ai.image_id,
        true,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN all_images ai
    WHERE jsonb_array_length(COALESCE($18::jsonb, '[]'::jsonb)) > 0
    ON CONFLICT (scenario_id, image_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_problem_statements_to_runs AS (
    -- Link problem statements to run if run_id provided
    INSERT INTO problem_statement_runs (problem_statement_id, run_id, created_at, updated_at)
    SELECT DISTINCT
        cps.problem_statement_id,
        $23::uuid,
        NOW(),
        NOW()
    FROM create_problem_statements cps
    WHERE $23::uuid IS NOT NULL
    ON CONFLICT (problem_statement_id, run_id) DO NOTHING
),
link_objectives_to_runs AS (
    -- Link objectives to run if run_id provided
    INSERT INTO objective_runs (objective_id, run_id, created_at, updated_at)
    SELECT DISTINCT
        ao.objective_id,
        $23::uuid,
        NOW(),
        NOW()
    FROM all_objectives ao
    WHERE $23::uuid IS NOT NULL
    ON CONFLICT (objective_id, run_id) DO NOTHING
),
link_videos AS (
    -- Link videos to scenario via junction table
    -- Only one video can be active at a time (enforced by unique index)
    INSERT INTO scenario_videos (scenario_id, video_id, active, created_at, updated_at)
    SELECT 
        ns.scenario_id::uuid,
        video_id::uuid,
        CASE 
            WHEN video_id::text = $20 THEN true  -- Active if matches active_video_id
            ELSE false
        END as active,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN UNNEST($19::text[]) as video_id
    WHERE COALESCE(array_length($19::text[], 1), 0) > 0
    ON CONFLICT (scenario_id, video_id) DO UPDATE SET
        active = CASE 
            WHEN video_id::text = $20 THEN true
            ELSE false
        END,
        updated_at = NOW()
),
link_questions AS (
    -- Link questions to scenario via junction table
    INSERT INTO scenario_questions (scenario_id, question_id, active, created_at, updated_at)
    SELECT 
        ns.scenario_id::uuid,
        question_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN UNNEST($21::text[]) as question_id
    WHERE COALESCE(array_length($21::text[], 1), 0) > 0
    ON CONFLICT (scenario_id, question_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_question_times AS (
    -- Link question times to videos
    -- question_timestamps JSONB structure: {"question_id": {"video_id": [time1, time2, ...]}}
    INSERT INTO scenario_question_times (scenario_id, question_id, video_id, time, active, created_at, updated_at)
    SELECT 
        ns.scenario_id::uuid,
        q_id::uuid,
        v_id::uuid,
        time_val,
        true,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN jsonb_each(COALESCE($22::jsonb, '{}'::jsonb)) as q_entry
    CROSS JOIN jsonb_each(q_entry.value) as v_entry
    CROSS JOIN jsonb_array_elements_text(v_entry.value) as time_val
    WHERE $22::jsonb IS NOT NULL
    AND jsonb_typeof($22::jsonb) = 'object'
    ON CONFLICT (scenario_id, question_id, video_id, time) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
-- Create default randomization ranges for new scenario
create_persona_ranges AS (
    INSERT INTO scenario_persona_ranges (scenario_id, min_count, max_count)
    SELECT ns.scenario_id::uuid, 1, 3
    FROM new_scenario ns
    ON CONFLICT (scenario_id) DO UPDATE SET
        updated_at = NOW()
),
create_document_ranges AS (
    INSERT INTO scenario_document_ranges (scenario_id, min_count, max_count)
    SELECT ns.scenario_id::uuid, 0, 3
    FROM new_scenario ns
    ON CONFLICT (scenario_id) DO UPDATE SET
        updated_at = NOW()
),
create_parameter_ranges AS (
    INSERT INTO scenario_parameter_ranges (scenario_id, min_count, max_count)
    SELECT ns.scenario_id::uuid, 0, 3
    FROM new_scenario ns
    ON CONFLICT (scenario_id) DO UPDATE SET
        updated_at = NOW()
),
create_field_ranges AS (
    -- Create field ranges for each parameter linked to the scenario
    INSERT INTO scenario_field_ranges (scenario_id, parameter_id, min_count, max_count)
    SELECT 
        ns.scenario_id::uuid,
        param_id::uuid,
        1,  -- default min
        3   -- default max
    FROM new_scenario ns
    CROSS JOIN UNNEST($23::text[]) as param_id
    WHERE COALESCE(array_length($24::text[], 1), 0) > 0
    ON CONFLICT (scenario_id, parameter_id) DO UPDATE SET
        updated_at = NOW()
)
SELECT 
    ns.scenario_id,
    ap.actor_name
FROM new_scenario ns
CROSS JOIN actor_profile ap

