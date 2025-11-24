-- Update video with all relationships in a single transaction
-- Parameters: $1=video_id, $2=name, $3=length_seconds, $4=active,
--            $5=department_ids (text array, nullable),
--            $6=problem_statement_ids (text array, nullable),
--            $7=objective_ids (text array, nullable),
--            $8=policy_ids (text array, nullable),
--            $9=questions_json (JSONB string with questions array)
-- Questions JSON structure: [{"question_text": "...", "type": "choice|frq", "allow_multiple": bool, "times": [seconds], "options": [{"option_text": "...", "type": "discrete|freeform", "is_correct": bool}]}]
-- Strategy: Delete all existing questions/options/times/links, then recreate from JSON

WITH updated_video AS (
    -- Update video core fields
    UPDATE videos
    SET 
        name = $2,
        length_seconds = $3,
        active = $4,
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
    CROSS JOIN UNNEST($5::text[]) as dept_id
    WHERE COALESCE(array_length($5::text[], 1), 0) > 0
),
delete_old_problem_statements AS (
    -- Delete old problem statement links
    DELETE FROM video_problem_statements
    WHERE video_id = $1::uuid
),
link_problem_statements AS (
    -- Link problem statements if provided
    INSERT INTO video_problem_statements (video_id, problem_statement_id, active, created_at, updated_at)
    SELECT 
        uv.video_id,
        ps_id::uuid,
        true,
        NOW(),
        NOW()
    FROM updated_video uv
    CROSS JOIN UNNEST($6::text[]) as ps_id
    WHERE COALESCE(array_length($6::text[], 1), 0) > 0
),
delete_old_objectives AS (
    -- Delete old objective links
    DELETE FROM video_objectives
    WHERE video_id = $1::uuid
),
link_objectives AS (
    -- Link objectives if provided (with idx for ordering)
    INSERT INTO video_objectives (video_id, objective_id, idx, created_at)
    SELECT 
        uv.video_id,
        obj_id::uuid,
        ROW_NUMBER() OVER () - 1 as idx,
        NOW()
    FROM updated_video uv
    CROSS JOIN UNNEST($7::text[]) as obj_id
    WHERE COALESCE(array_length($7::text[], 1), 0) > 0
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
    CROSS JOIN UNNEST($8::text[]) as policy_id
    WHERE COALESCE(array_length($8::text[], 1), 0) > 0
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
    -- Create questions (or get existing if they match)
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
    ON CONFLICT DO NOTHING
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
delete_old_question_options AS (
    -- Delete old question-option links for questions in this video
    DELETE FROM question_options
    WHERE question_id IN (SELECT question_id FROM all_questions)
),
delete_old_question_answers AS (
    -- Delete old question-answer links for questions in this video
    DELETE FROM question_answers
    WHERE question_id IN (SELECT question_id FROM all_questions)
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
)
SELECT video_id::uuid, name FROM updated_video

