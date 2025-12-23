-- Complete quiz - marks as completed and validates all answers are correct
-- Parameters: $1 = quiz_id (uuid)
-- Returns: all_correct (boolean)

WITH quiz_check AS (
    -- Verify quiz exists
    SELECT 
        q.id as quiz_id,
        q.video_id,
        q.completed as current_completed
    FROM quizzes q
    WHERE q.id = $1::uuid
    LIMIT 1
),
video_questions_list AS (
    -- Get all questions for this video
    SELECT DISTINCT
        qc.quiz_id,
        q.id as question_id
    FROM quiz_check qc
    JOIN videos v ON v.id = qc.video_id
    JOIN scenario_videos sv ON sv.video_id = v.id AND sv.active = true
    JOIN scenario_questions sq ON sq.scenario_id = sv.scenario_id AND sq.active = true
    JOIN questions q ON q.id = sq.question_id AND q.active = true
),
quiz_responses_summary AS (
    -- Get all responses for this quiz
    SELECT 
        qr.question_id,
        qr.option_id,
        qr.completed as response_completed,
        CASE WHEN qa.option_id IS NOT NULL THEN true ELSE false END as is_correct_answer
    FROM quiz_check qc
    JOIN quiz_responses qr ON qr.quiz_id = qc.quiz_id
    LEFT JOIN question_answers qa ON qa.question_id = qr.question_id 
        AND qa.option_id = qr.option_id 
        AND qa.active = true
),
question_correctness AS (
    -- Check if each question has at least one correct answer
    SELECT 
        vql.question_id,
        BOOL_OR(qrs.is_correct_answer) as has_correct_answer
    FROM video_questions_list vql
    LEFT JOIN quiz_responses_summary qrs ON qrs.question_id = vql.question_id
    GROUP BY vql.question_id
),
all_questions_correct AS (
    -- Check if all questions have correct answers
    SELECT 
        CASE 
            WHEN COUNT(*) = 0 THEN false  -- No questions means not correct
            WHEN COUNT(*) FILTER (WHERE has_correct_answer = false) > 0 THEN false
            ELSE true
        END as all_correct
    FROM question_correctness
),
update_quiz AS (
    -- Mark quiz as completed
    UPDATE quizzes
    SET completed = true,
        updated_at = NOW()
    FROM quiz_check qc, all_questions_correct acc
    WHERE quizzes.id = qc.quiz_id
        AND acc.all_correct = true  -- Only mark completed if all correct
    RETURNING quizzes.id as quiz_id
)
SELECT 
    COALESCE(
        (SELECT all_correct FROM all_questions_correct),
        false
    ) as all_correct

