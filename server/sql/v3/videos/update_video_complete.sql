-- Update video with all relationships in a single transaction
-- Parameters: $1=video_id, $2=name, $3=length_seconds, $4=active,
--            $5=upload_id (uuid, nullable),
--            $6=department_ids (text array, nullable),
--            $7=outline_ids (text array, nullable),
--            $8=document_ids (text array, nullable),
--            $9=upload_images_json (JSONB string with upload images array),
--            $10=questions_json (JSONB string with questions array),
--            $11=outline_agent_id (nullable uuid), $12=image_agent_id (nullable uuid),
--            $13=parameter_item_ids (text array, nullable),
--            $14=persona_ids (text array, nullable)
-- Upload images JSON structure: [{"upload_id": "...", "name": "..."}]
-- Questions JSON structure: [{"question_text": "...", "allow_multiple": bool, "times": [seconds], "options": [{"option_text": "...", "type": "discrete|freeform", "is_correct": bool}]}]
-- Strategy: Delete all existing questions/options/times/links, then recreate from JSON
-- Note: file_path and mime_type are NOT updated here - they're managed via video_generations table when video file is generated/uploaded

WITH updated_video AS (
    -- Update video core fields
    UPDATE videos
    SET 
        name = $2,
        length_seconds = $3,
        active = $4,
        upload_id = COALESCE($5::uuid, upload_id),
        outline_agent_id = COALESCE($11::uuid, outline_agent_id),
        image_agent_id = COALESCE($12::uuid, image_agent_id),
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
    CROSS JOIN UNNEST(COALESCE($6::text[], ARRAY[]::text[])) as dept_id
    WHERE COALESCE(array_length($6::text[], 1), 0) > 0
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
    CROSS JOIN UNNEST(COALESCE($7::text[], ARRAY[]::text[])) as outline_id
    WHERE COALESCE(array_length($7::text[], 1), 0) > 0
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
          FROM UNNEST(COALESCE($7::text[], ARRAY[]::text[])) as outline_id
      )
),
delete_old_documents AS (
    -- Delete old document links
    DELETE FROM video_documents
    WHERE video_id = $1::uuid
),
link_documents AS (
    -- Link documents if provided
    INSERT INTO video_documents (video_id, document_id, active, created_at, updated_at)
    SELECT 
        uv.video_id,
        document_id::uuid,
        true,
        NOW(),
        NOW()
    FROM updated_video uv
    CROSS JOIN UNNEST(COALESCE($8::text[], ARRAY[]::text[])) as document_id
    WHERE COALESCE(array_length($8::text[], 1), 0) > 0
    ON CONFLICT (video_id, document_id) DO UPDATE SET
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
    INSERT INTO video_images (video_id, upload_id, name, active, created_at, updated_at)
    SELECT 
        uv.video_id,
        (img->>'upload_id')::uuid,
        img->>'name',
        true,
        NOW(),
        NOW()
    FROM updated_video uv
    CROSS JOIN jsonb_array_elements(COALESCE($9::jsonb, '[]'::jsonb)) as img
    WHERE jsonb_array_length(COALESCE($9::jsonb, '[]'::jsonb)) > 0
    ON CONFLICT (video_id, upload_id) DO UPDATE SET
        active = true,
        name = EXCLUDED.name,
        updated_at = NOW()
),
questions_data AS (
    -- Parse questions from JSON
    SELECT 
        q->>'question_text' as question_text,
        COALESCE((q->>'allow_multiple')::boolean, false) as allow_multiple,
        ARRAY(SELECT jsonb_array_elements_text(q->'times'))::integer[] as times,
        q->'options' as options_json
    FROM updated_video uv
    CROSS JOIN jsonb_array_elements($10::jsonb) as q
),
create_questions AS (
    -- Create questions (only if they don't already exist)
    -- Check for existing questions first to avoid duplicates
    INSERT INTO questions (question_text, allow_multiple, active, created_at, updated_at)
    SELECT DISTINCT
        qd.question_text,
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
            AND q.allow_multiple = qd.allow_multiple
            AND q.active = true
      )
    RETURNING id::uuid as question_id, question_text, allow_multiple
),
get_existing_questions AS (
    -- Get existing questions that match
    SELECT 
        q.id as question_id,
        q.question_text,
        q.allow_multiple
    FROM questions q
    JOIN questions_data qd ON q.question_text = qd.question_text 
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
        AND aq.allow_multiple = qd.allow_multiple
    CROSS JOIN UNNEST(qd.times) as time_seconds
    WHERE time_seconds IS NOT NULL AND time_seconds >= 0
    ON CONFLICT (video_id, question_id, time) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
options_data AS (
    -- Extract options from questions
    SELECT DISTINCT
        aq.question_id,
        opt->>'option_text' as option_text,
        opt->>'type' as option_type,
        COALESCE((opt->>'is_correct')::boolean, false) as is_correct
    FROM questions_data qd
    JOIN all_questions aq ON aq.question_text = qd.question_text 
        AND aq.allow_multiple = qd.allow_multiple
    CROSS JOIN jsonb_array_elements(qd.options_json) as opt
    WHERE qd.options_json IS NOT NULL
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
    -- Delete all existing field links
    DELETE FROM video_fields 
    WHERE video_id = $1::uuid
),
insert_video_parameters AS (
    -- Insert new field links
    INSERT INTO video_fields (video_id, field_id, active, created_at, updated_at)
    SELECT 
        uv.video_id,
        field_id::uuid,
        true,
        NOW(),
        NOW()
    FROM updated_video uv
    CROSS JOIN UNNEST(COALESCE($13::text[], ARRAY[]::text[])) as param_item_id
    WHERE COALESCE(array_length($13::text[], 1), 0) > 0
    ON CONFLICT (video_id, field_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_video_personas AS (
    -- Delete all existing persona links
    DELETE FROM video_personas 
    WHERE video_id = $1::uuid
),
insert_video_personas AS (
    -- Insert new persona links
    INSERT INTO video_personas (video_id, persona_id, active, created_at, updated_at)
    SELECT 
        uv.video_id,
        persona_id::uuid,
        true,
        NOW(),
        NOW()
    FROM updated_video uv
    CROSS JOIN UNNEST(COALESCE($14::text[], ARRAY[]::text[])) as persona_id
    WHERE COALESCE(array_length($14::text[], 1), 0) > 0
    ON CONFLICT (video_id, persona_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT video_id::uuid, name FROM updated_video

