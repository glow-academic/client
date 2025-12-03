-- Update video with all relationships in a single transaction
-- Parameters: $1=video_id, $2=name, $3=length_seconds, $4=active,
--            $5=department_ids (text array, nullable),
--            $6=outline_ids (text array, nullable),
--            $7=policy_ids (text array, nullable),
--            $8=image_ids (text array, nullable),
--            $9=questions_json (JSONB string with questions array),
--            $10=outline_agent_id (nullable uuid), $11=image_agent_id (nullable uuid),
--            $12=parameter_item_ids (text array, nullable)
-- Questions JSON structure: [{"question_text": "...", "type": "choice|frq", "allow_multiple": bool, "times": [seconds], "options": [{"option_text": "...", "type": "discrete|freeform", "is_correct": bool}]}]
-- Strategy: Delete all existing questions/options/times/links, then recreate from JSON
-- Note: file_path and mime_type are NOT updated here - they're managed via video_generations table when video file is generated/uploaded

WITH updated_video AS (
    -- Update video core fields
    UPDATE videos
    SET 
        name = $2,
        length_seconds = $3,
        active = $4,
        outline_agent_id = COALESCE($10::uuid, outline_agent_id),
        image_agent_id = COALESCE($11::uuid, image_agent_id),
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::uuid as video_id, name
),
delete_old_question_times AS (
    -- Delete old question times
    DELETE FROM question_times
    WHERE video_id = $1::uuid
),
delete_old_video_questions AS (
    -- Delete old video-question links
    DELETE FROM video_questions
    WHERE video_id = $1::uuid
),
delete_old_departments AS (
    -- Delete old department links
    DELETE FROM video_departments
    WHERE video_id = $1::uuid
),
link_departments AS (
    -- Link departments if provided
    INSERT INTO video_departments (video_id, department_id, active, created_at, updated_at)
    SELECT 
        uv.video_id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM updated_video uv
    CROSS JOIN UNNEST(COALESCE($5::text[], ARRAY[]::text[])) as dept_id
    WHERE COALESCE(array_length($5::text[], 1), 0) > 0
    ON CONFLICT (video_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_outlines AS (
    -- Link outlines if provided (insert or update existing)
    INSERT INTO video_outlines (video_id, outline_id, active, created_at, updated_at)
    SELECT 
        uv.video_id,
        outline_id::uuid,
        true,
        NOW(),
        NOW()
    FROM updated_video uv
    CROSS JOIN UNNEST(COALESCE($6::text[], ARRAY[]::text[])) as outline_id
    WHERE COALESCE(array_length($6::text[], 1), 0) > 0
    ON CONFLICT (video_id, outline_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
delete_old_outlines AS (
    -- Delete outline links that are NOT in the new list
    DELETE FROM video_outlines
    WHERE video_id = $1::uuid
      AND outline_id NOT IN (
          SELECT outline_id::uuid
          FROM UNNEST(COALESCE($6::text[], ARRAY[]::text[])) as outline_id
      )
),
delete_old_policies AS (
    -- Delete old policy links
    DELETE FROM video_policies
    WHERE video_id = $1::uuid
),
link_policies AS (
    -- Link policies if provided
    INSERT INTO video_policies (video_id, policy_id, active, created_at, updated_at)
    SELECT 
        uv.video_id,
        policy_id::uuid,
        true,
        NOW(),
        NOW()
    FROM updated_video uv
    CROSS JOIN UNNEST(COALESCE($7::text[], ARRAY[]::text[])) as policy_id
    WHERE COALESCE(array_length($7::text[], 1), 0) > 0
    ON CONFLICT (video_id, policy_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
delete_old_video_images AS (
    -- Delete old video image links (junction table entries)
    DELETE FROM video_images
    WHERE video_id = $1::uuid
),
link_video_images AS (
    -- Link video images if provided (create junction table entries)
    INSERT INTO video_images (video_id, image_id, active, created_at, updated_at)
    SELECT 
        uv.video_id,
        image_id::uuid,
        true,
        NOW(),
        NOW()
    FROM updated_video uv
    CROSS JOIN UNNEST(COALESCE($8::text[], ARRAY[]::text[])) as image_id
    WHERE COALESCE(array_length($8::text[], 1), 0) > 0
    ON CONFLICT (video_id, image_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
questions_data AS (
    -- Parse questions from JSON
    SELECT 
        q->>'question_text' as question_text,
        q->>'type' as question_type,
        COALESCE((q->>'allow_multiple')::boolean, false) as allow_multiple,
        ARRAY(SELECT jsonb_array_elements_text(q->'times'))::integer[] as times,
        q->'options' as options_json
    FROM updated_video uv
    CROSS JOIN jsonb_array_elements($9::jsonb) as q
),
create_questions AS (
    -- Create questions (only if they don't already exist)
    -- Check for existing questions first to avoid duplicates
    INSERT INTO questions (question_text, type, allow_multiple, active, created_at, updated_at)
    SELECT DISTINCT
        qd.question_text,
        qd.question_type::question_type,
        qd.allow_multiple,
        true,
        NOW(),
        NOW()
    FROM questions_data qd
    WHERE qd.question_text IS NOT NULL 
      AND qd.question_text != ''
      AND NOT EXISTS (
          SELECT 1 FROM questions q 
          WHERE q.question_text = qd.question_text
            AND q.type::text = qd.question_type
            AND q.allow_multiple = qd.allow_multiple
            AND q.active = true
      )
    RETURNING id::uuid as question_id, question_text, type, allow_multiple
),
get_existing_questions AS (
    -- Get existing questions that match
    SELECT 
        q.id as question_id,
        q.question_text,
        q.type,
        q.allow_multiple
    FROM questions q
    JOIN questions_data qd ON q.question_text = qd.question_text 
        AND q.type::text = qd.question_type 
        AND q.allow_multiple = qd.allow_multiple
    WHERE q.active = true
),
all_questions AS (
    SELECT * FROM create_questions
    UNION
    SELECT * FROM get_existing_questions
),
link_video_questions AS (
    -- Link questions to video
    INSERT INTO video_questions (video_id, question_id, active, created_at, updated_at)
    SELECT DISTINCT
        uv.video_id,
        aq.question_id,
        true,
        NOW(),
        NOW()
    FROM updated_video uv
    CROSS JOIN questions_data qd
    JOIN all_questions aq ON aq.question_text = qd.question_text 
        AND aq.type::text = qd.question_type 
        AND aq.allow_multiple = qd.allow_multiple
    ON CONFLICT (video_id, question_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
create_question_times AS (
    -- Create question times
    INSERT INTO question_times (video_id, question_id, time, active, created_at, updated_at)
    SELECT DISTINCT
        uv.video_id,
        aq.question_id,
        time_seconds,
        true,
        NOW(),
        NOW()
    FROM updated_video uv
    CROSS JOIN questions_data qd
    JOIN all_questions aq ON aq.question_text = qd.question_text 
        AND aq.type::text = qd.question_type 
        AND aq.allow_multiple = qd.allow_multiple
    CROSS JOIN UNNEST(qd.times) as time_seconds
    WHERE time_seconds IS NOT NULL AND time_seconds >= 0
    ON CONFLICT (video_id, question_id, time) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
options_data AS (
    -- Extract options from questions (only for choice questions)
    SELECT DISTINCT
        aq.question_id,
        opt->>'option_text' as option_text,
        opt->>'type' as option_type,
        COALESCE((opt->>'is_correct')::boolean, false) as is_correct
    FROM questions_data qd
    JOIN all_questions aq ON aq.question_text = qd.question_text 
        AND aq.type::text = qd.question_type 
        AND aq.allow_multiple = qd.allow_multiple
    CROSS JOIN jsonb_array_elements(qd.options_json) as opt
    WHERE qd.question_type = 'choice' AND qd.options_json IS NOT NULL
),
-- Note: We do NOT delete question_options or question_answers here because:
-- 1. These are global tables shared across all videos
-- 2. If a question is used in multiple videos, deleting its options/answers would affect other videos
-- 3. We use INSERT ... ON CONFLICT DO UPDATE to ensure correct state without deleting
-- 4. If an option is no longer correct, we'll handle it by only inserting the new correct answers
--    (old incorrect answers remain but won't be marked as correct)
create_options AS (
    -- Create options (only if they don't already exist)
    -- Check for existing options first to avoid duplicates
    INSERT INTO options (option_text, type, active, created_at, updated_at)
    SELECT DISTINCT
        od.option_text,
        od.option_type::option_type,
        true,
        NOW(),
        NOW()
    FROM options_data od
    WHERE od.option_text IS NOT NULL 
      AND od.option_text != ''
      AND NOT EXISTS (
          SELECT 1 FROM options o 
          WHERE o.option_text = od.option_text
            AND o.type::text = od.option_type
            AND o.active = true
      )
    RETURNING id::uuid as option_id, option_text, type
),
get_existing_options AS (
    -- Get existing options that match
    SELECT 
        o.id as option_id,
        o.option_text,
        o.type
    FROM options o
    JOIN options_data od ON o.option_text = od.option_text AND o.type::text = od.option_type
    WHERE o.active = true
),
all_options AS (
    SELECT * FROM create_options
    UNION
    SELECT * FROM get_existing_options
),
link_question_options AS (
    -- Link options to questions
    INSERT INTO question_options (question_id, option_id, active, created_at, updated_at)
    SELECT DISTINCT
        od.question_id,
        ao.option_id,
        true,
        NOW(),
        NOW()
    FROM options_data od
    JOIN all_options ao ON ao.option_text = od.option_text AND ao.type::text = od.option_type
    ON CONFLICT (question_id, option_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_question_answers AS (
    -- Link correct answers (only for options marked as correct)
    INSERT INTO question_answers (question_id, option_id, active, created_at, updated_at)
    SELECT DISTINCT
        od.question_id,
        ao.option_id,
        true,
        NOW(),
        NOW()
    FROM options_data od
    JOIN all_options ao ON ao.option_text = od.option_text AND ao.type::text = od.option_type
    WHERE od.is_correct = true
    ON CONFLICT (question_id, option_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_video_parameters AS (
    -- Delete all existing parameter links
    DELETE FROM video_parameter_items 
    WHERE video_id = $1::uuid
),
insert_video_parameters AS (
    -- Insert new parameter links
    INSERT INTO video_parameter_items (video_id, parameter_item_id, active, created_at, updated_at)
    SELECT 
        uv.video_id,
        param_item_id::uuid,
        true,
        NOW(),
        NOW()
    FROM updated_video uv
    CROSS JOIN UNNEST(COALESCE($12::text[], ARRAY[]::text[])) as param_item_id
    WHERE COALESCE(array_length($12::text[], 1), 0) > 0
    ON CONFLICT (video_id, parameter_item_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT video_id::uuid, name FROM updated_video

