-- Save question timestamps for a video
-- Parameters: $1 = video_id (uuid), $2 = question_timestamps (jsonb) - format: {"question-id-1": [10, 30], "question-id-2": [45]}
-- This will:
-- 1. Ensure video_questions entries exist (create if needed)
-- 2. Delete old question_times for these questions
-- 3. Insert new question_times

WITH video_id_param AS (
    SELECT $1::uuid as video_id
),
question_timestamps_data AS (
    -- Parse question timestamps from JSONB
    SELECT 
        key::uuid as question_id,
        ARRAY(SELECT jsonb_array_elements_text(value))::integer[] as times
    FROM video_id_param vip
    CROSS JOIN jsonb_each($2::jsonb)
),
ensure_video_questions AS (
    -- Ensure video_questions entries exist
    INSERT INTO video_questions (video_id, question_id, active, created_at, updated_at)
    SELECT DISTINCT
        vip.video_id,
        qtd.question_id,
        true,
        NOW(),
        NOW()
    FROM video_id_param vip
    CROSS JOIN question_timestamps_data qtd
    WHERE qtd.question_id IS NOT NULL
    ON CONFLICT (video_id, question_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
delete_old_question_times AS (
    -- Delete old question_times for these questions
    DELETE FROM question_times qt
    USING video_id_param vip, question_timestamps_data qtd
    WHERE qt.video_id = vip.video_id
        AND qt.question_id = qtd.question_id
),
insert_question_times AS (
    -- Insert new question_times
    INSERT INTO question_times (video_id, question_id, time, active, created_at, updated_at)
    SELECT DISTINCT
        vip.video_id,
        qtd.question_id,
        time_seconds,
        true,
        NOW(),
        NOW()
    FROM video_id_param vip
    CROSS JOIN question_timestamps_data qtd
    CROSS JOIN UNNEST(qtd.times) as time_seconds
    WHERE qtd.question_id IS NOT NULL 
        AND time_seconds IS NOT NULL 
        AND time_seconds >= 0
    ON CONFLICT (video_id, question_id, time) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT COUNT(*) as inserted_count
FROM insert_question_times;

