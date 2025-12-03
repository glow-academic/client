-- Create video with all relationships in a single transaction
-- Parameters: $1=name, $2=length_seconds, $3=active,
--            $4=department_ids (text array, nullable),
--            $5=outline_ids (text array, nullable),
--            $6=policy_ids (text array, nullable),
--            $7=image_ids (text array, nullable),
--            $8=questions_json (JSONB string with questions array),
--            $9=parameter_item_ids (text array, nullable)
-- Questions JSON structure: [{"question_text": "...", "type": "choice|frq", "allow_multiple": bool, "times": [seconds], "options": [{"option_text": "...", "type": "discrete|freeform", "is_correct": bool}]}]
-- Note: Video file is created separately via video_generations table when file is generated/uploaded

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
link_policies AS (
    -- Link policies if provided
    INSERT INTO video_policies (video_id, policy_id, active, created_at, updated_at)
    SELECT 
        nv.video_id,
        policy_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_video nv
    CROSS JOIN UNNEST($6::text[]) as policy_id
    WHERE COALESCE(array_length($6::text[], 1), 0) > 0
    ON CONFLICT (video_id, policy_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_video_images AS (
    -- Link video images if provided (create junction table entries)
    -- Note: images must be created via upload finalize endpoint first
    INSERT INTO video_images (video_id, image_id, active, created_at, updated_at)
    SELECT 
        nv.video_id,
        image_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_video nv
    CROSS JOIN UNNEST($7::text[]) as image_id
    WHERE COALESCE(array_length($7::text[], 1), 0) > 0
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
        q->>'type' as question_type,
        COALESCE((q->>'allow_multiple')::boolean, false) as allow_multiple,
        ARRAY(SELECT jsonb_array_elements_text(q->'times'))::integer[] as times,
        q->'options' as options_json
    FROM new_video nv
    CROSS JOIN jsonb_array_elements($8::jsonb) as q
),
create_questions AS (
    -- Create questions
    INSERT INTO questions (question_text, type, allow_multiple, active, created_at, updated_at)
    SELECT DISTINCT
        qd.question_text,
        qd.question_type::question_type,
        qd.allow_multiple,
        true,
        NOW(),
        NOW()
    FROM questions_data qd
    WHERE qd.question_text IS NOT NULL AND qd.question_text != ''
    RETURNING id::uuid as question_id, question_text, type, allow_multiple
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
        AND cq.type::text = qd.question_type 
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
        AND cq.type::text = qd.question_type 
        AND cq.allow_multiple = qd.allow_multiple
    CROSS JOIN UNNEST(qd.times) as time_seconds
    WHERE time_seconds IS NOT NULL AND time_seconds >= 0
    ON CONFLICT (video_id, question_id, time) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
options_data AS (
    -- Extract options from questions (only for choice questions)
    SELECT DISTINCT
        cq.question_id,
        opt->>'option_text' as option_text,
        opt->>'type' as option_type,
        COALESCE((opt->>'is_correct')::boolean, false) as is_correct
    FROM questions_data qd
    JOIN create_questions cq ON cq.question_text = qd.question_text 
        AND cq.type::text = qd.question_type 
        AND cq.allow_multiple = qd.allow_multiple
    CROSS JOIN jsonb_array_elements(qd.options_json) as opt
    WHERE qd.question_type = 'choice' AND qd.options_json IS NOT NULL
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
link_video_parameter_items AS (
    -- Link parameter items to video if provided
    INSERT INTO video_parameter_items (video_id, parameter_item_id, active, created_at, updated_at)
    SELECT 
        nv.video_id,
        param_item_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_video nv
    CROSS JOIN UNNEST($9::text[]) as param_item_id
    WHERE COALESCE(array_length($9::text[], 1), 0) > 0
    ON CONFLICT (video_id, parameter_item_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT video_id::text as video_id FROM new_video

