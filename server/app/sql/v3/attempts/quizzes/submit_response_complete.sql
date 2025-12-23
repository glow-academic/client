-- Submit quiz response for question + option
-- Parameters: $1 = quiz_id (uuid), $2 = question_id (uuid), $3 = option_id (uuid)
-- Returns: is_correct (boolean)

WITH quiz_check AS (
    -- Verify quiz exists
    SELECT id as quiz_id
    FROM quizzes
    WHERE id = $1::uuid
    LIMIT 1
),
question_option_check AS (
    -- Verify question and option are valid for this quiz's video
    SELECT 
        qc.quiz_id,
        q.id as question_id,
        o.id as option_id,
        v.id as video_id
    FROM quiz_check qc
    JOIN quizzes q ON q.id = qc.quiz_id
    JOIN videos v ON v.id = q.video_id
    JOIN video_questions vq ON vq.video_id = v.id AND vq.question_id = $2::uuid AND vq.active = true
    JOIN questions q2 ON q2.id = vq.question_id AND q2.id = $2::uuid AND q2.active = true
    JOIN question_options qo ON qo.question_id = q2.id AND qo.option_id = $3::uuid AND qo.active = true
    JOIN options o ON o.id = qo.option_id AND o.id = $3::uuid AND o.active = true
    LIMIT 1
),
check_correctness AS (
    -- Check if the option is a correct answer for this question
    SELECT 
        qoc.quiz_id,
        qoc.question_id,
        qoc.option_id,
        CASE WHEN qa.option_id IS NOT NULL THEN true ELSE false END as is_correct
    FROM question_option_check qoc
    LEFT JOIN question_answers qa ON qa.question_id = qoc.question_id 
        AND qa.option_id = qoc.option_id 
        AND qa.active = true
),
delete_old_responses AS (
    -- Delete old responses for this question
    DELETE FROM quiz_responses qr
    USING check_correctness cc
    WHERE qr.quiz_id = cc.quiz_id
        AND qr.question_id = cc.question_id
),
insert_response AS (
    -- Insert new quiz response
    INSERT INTO quiz_responses (quiz_id, question_id, option_id, completed, created_at, updated_at)
    SELECT 
        cc.quiz_id,
        cc.question_id,
        cc.option_id,
        cc.is_correct,  -- Mark as completed if correct
        NOW(),
        NOW()
    FROM check_correctness cc
    RETURNING completed as is_correct
)
SELECT 
    COALESCE(
        (SELECT is_correct FROM insert_response),
        (SELECT is_correct FROM check_correctness)
    ) as is_correct

