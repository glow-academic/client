-- Create video with all relationships in a single transaction
-- Parameters: $1=name, $2=length_seconds, $3=active,
--            $4=department_ids (text array, nullable),
--            $5=outline_ids (text array, nullable),
--            $6=document_ids (text array, nullable),
--            $7=upload_images_json (JSONB string with upload images array),
--            $8=questions_json (JSONB string with questions array),
--            $9=parameter_item_ids (text array, nullable),
--            $10=persona_ids (text array, nullable)
-- Upload images JSON structure: [{"upload_id": "...", "name": "..."}]
-- Questions JSON structure: [{"question_text": "...", "allow_multiple": bool, "times": [seconds], "options": [{"option_text": "...", "type": "discrete|freeform", "is_correct": bool}]}]

WITH new_video AS (
    INSERT INTO videos (
        name,
        length_seconds,
        active
    )
    VALUES ($1, $2, $3)
    RETURNING id::uuid as video_id
),
link_departments AS (
    -- Link departments if provided
    INSERT INTO video_departments (video_id, department_id, active, created_at, updated_at)
    SELECT 
        nv.video_id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_video nv
    CROSS JOIN UNNEST($4::text[]) as dept_id
    WHERE COALESCE(array_length($4::text[], 1), 0) > 0
    ON CONFLICT (video_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_outlines AS (
    -- Link outlines if provided
    INSERT INTO video_outlines (video_id, outline_id, active, created_at, updated_at)
    SELECT 
        nv.video_id,
        outline_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_video nv
    CROSS JOIN UNNEST($5::text[]) as outline_id
    WHERE COALESCE(array_length($5::text[], 1), 0) > 0
    ON CONFLICT (video_id, outline_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_documents AS (
    -- Link documents if provided
    INSERT INTO video_documents (video_id, document_id, active, created_at, updated_at)
    SELECT 
        nv.video_id,
        document_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_video nv
    CROSS JOIN UNNEST($6::text[]) as document_id
    WHERE COALESCE(array_length($6::text[], 1), 0) > 0
    ON CONFLICT (video_id, document_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
create_video_images AS (
    -- Create images from uploads if they don't exist
    INSERT INTO images (name, upload_id, created_at, updated_at, active)
    SELECT DISTINCT
        img->>'name',
        (img->>'upload_id')::uuid,
        NOW(),
        NOW(),
        true
    FROM jsonb_array_elements(COALESCE($7::jsonb, '[]'::jsonb)) as img
    WHERE jsonb_array_length(COALESCE($7::jsonb, '[]'::jsonb)) > 0
      AND NOT EXISTS (
          SELECT 1 FROM images i 
          WHERE i.upload_id = (img->>'upload_id')::uuid AND i.name = img->>'name'
      )
    RETURNING id as image_id, upload_id
),
get_video_images AS (
    -- Get existing images
    SELECT i.id as image_id, i.upload_id
    FROM jsonb_array_elements(COALESCE($8::jsonb, '[]'::jsonb)) as img
    JOIN images i ON i.upload_id = (img->>'upload_id')::uuid AND i.name = img->>'name'
),
all_video_images AS (
    SELECT image_id, upload_id FROM create_video_images
    UNION
    SELECT image_id, upload_id FROM get_video_images
),
link_video_images AS (
    -- Link images to video via junction table
    INSERT INTO video_images (video_id, image_id, active, created_at, updated_at)
    SELECT 
        nv.video_id,
        avi.image_id,
        true,
        NOW(),
        NOW()
    FROM new_video nv
    CROSS JOIN all_video_images avi
    WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE($7::jsonb, '[]'::jsonb)) WHERE jsonb_array_length(COALESCE($7::jsonb, '[]'::jsonb)) > 0)
    ON CONFLICT (video_id, image_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_tree_edge AS (
    -- Insert self-referencing edge in video_tree (marks as root)
    INSERT INTO video_tree (parent_id, child_id, active, created_at, updated_at)
    SELECT nv.video_id, nv.video_id, true, NOW(), NOW()
    FROM new_video nv
),
questions_data AS (
    -- Parse questions from JSON
    SELECT 
        q->>'question_text' as question_text,
        COALESCE((q->>'allow_multiple')::boolean, false) as allow_multiple,
        ARRAY(SELECT jsonb_array_elements_text(q->'times'))::integer[] as times,
        q->'options' as options_json
    FROM new_video nv
    CROSS JOIN jsonb_array_elements($8::jsonb) as q
),
create_questions AS (
    -- Create questions
    INSERT INTO questions (question_text, allow_multiple, active, created_at, updated_at)
    SELECT DISTINCT
        qd.question_text,
        qd.allow_multiple,
        true,
        NOW(),
        NOW()
    FROM questions_data qd
    WHERE qd.question_text IS NOT NULL AND qd.question_text != ''
    RETURNING id::uuid as question_id, question_text, allow_multiple
),
link_video_questions AS (
    -- Link questions to video
    INSERT INTO video_questions (video_id, question_id, active, created_at, updated_at)
    SELECT DISTINCT
        nv.video_id,
        cq.question_id,
        true,
        NOW(),
        NOW()
    FROM new_video nv
    CROSS JOIN questions_data qd
    JOIN create_questions cq ON cq.question_text = qd.question_text 
        AND cq.allow_multiple = qd.allow_multiple
    ON CONFLICT (video_id, question_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
create_question_times AS (
    -- Create question times
    INSERT INTO question_times (video_id, question_id, time, active, created_at, updated_at)
    SELECT DISTINCT
        nv.video_id,
        cq.question_id,
        time_seconds,
        true,
        NOW(),
        NOW()
    FROM new_video nv
    CROSS JOIN questions_data qd
    JOIN create_questions cq ON cq.question_text = qd.question_text 
        AND cq.allow_multiple = qd.allow_multiple
    CROSS JOIN UNNEST(qd.times) as time_seconds
    WHERE time_seconds IS NOT NULL AND time_seconds >= 0
    ON CONFLICT (video_id, question_id, time) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
options_data AS (
    -- Extract options from questions
    SELECT DISTINCT
        cq.question_id,
        opt->>'option_text' as option_text,
        opt->>'type' as option_type,
        COALESCE((opt->>'is_correct')::boolean, false) as is_correct
    FROM questions_data qd
    JOIN create_questions cq ON cq.question_text = qd.question_text 
        AND cq.allow_multiple = qd.allow_multiple
    CROSS JOIN jsonb_array_elements(qd.options_json) as opt
    WHERE qd.options_json IS NOT NULL
),
create_options AS (
    -- Create options
    INSERT INTO options (option_text, type, active, created_at, updated_at)
    SELECT DISTINCT
        od.option_text,
        od.option_type::option_type,
        true,
        NOW(),
        NOW()
    FROM options_data od
    WHERE od.option_text IS NOT NULL AND od.option_text != ''
    ON CONFLICT DO NOTHING
    RETURNING id::uuid as option_id, option_text, type
),
link_question_options AS (
    -- Link options to questions
    INSERT INTO question_options (question_id, option_id, active, created_at, updated_at)
    SELECT DISTINCT
        od.question_id,
        co.option_id,
        true,
        NOW(),
        NOW()
    FROM options_data od
    JOIN create_options co ON co.option_text = od.option_text AND co.type::text = od.option_type
    ON CONFLICT (question_id, option_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_question_answers AS (
    -- Link correct answers (only for options marked as correct)
    INSERT INTO question_answers (question_id, option_id, active, created_at, updated_at)
    SELECT DISTINCT
        od.question_id,
        co.option_id,
        true,
        NOW(),
        NOW()
    FROM options_data od
    JOIN create_options co ON co.option_text = od.option_text AND co.type::text = od.option_type
    WHERE od.is_correct = true
    ON CONFLICT (question_id, option_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_video_fields AS (
    -- Link fields to video if provided
    INSERT INTO video_fields (video_id, field_id, active, created_at, updated_at)
    SELECT 
        nv.video_id,
        field_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_video nv
    CROSS JOIN UNNEST($9::text[]) as param_item_id
    WHERE COALESCE(array_length($9::text[], 1), 0) > 0
    ON CONFLICT (video_id, field_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_video_personas AS (
    -- Link personas to video if provided
    INSERT INTO video_personas (video_id, persona_id, active, created_at, updated_at)
    SELECT 
        nv.video_id,
        persona_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_video nv
    CROSS JOIN UNNEST($10::text[]) as persona_id
    WHERE COALESCE(array_length($10::text[], 1), 0) > 0
    ON CONFLICT (video_id, persona_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT video_id::text as video_id FROM new_video

