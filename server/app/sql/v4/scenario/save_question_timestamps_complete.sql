-- Save question timestamps for scenario questions linked to videos
-- Converted to PostgreSQL function
-- Note: Now updates questions.time directly (time moved from scenario_question_times to questions table)
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_save_question_timestamps_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_question_timestamps_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_save_question_timestamps_v4(
    scenario_id uuid,
    video_id uuid,
    question_timestamps jsonb
)
RETURNS TABLE (
    updated_count integer
)
LANGUAGE sql
VOLATILE
AS $$
WITH update_question_times AS (
    -- Update questions.time with first timestamp value from question_timestamps
    UPDATE questions
    SET time = COALESCE(
        (SELECT (time_val::text)::integer
         FROM jsonb_array_elements_text(
             (SELECT q_entry.value 
              FROM jsonb_each(COALESCE(question_timestamps, '{}'::jsonb)) as q_entry
              WHERE (q_entry.key)::uuid = questions.id
              LIMIT 1)
         ) as time_val
         LIMIT 1),
        questions.time
    ),
    updated_at = NOW()
    WHERE EXISTS (
        SELECT 1
        FROM jsonb_each(COALESCE(question_timestamps, '{}'::jsonb)) as q_entry
        WHERE (q_entry.key)::uuid = questions.id
        AND jsonb_typeof(q_entry.value) = 'array'
        AND jsonb_array_length(q_entry.value) > 0
    )
    AND EXISTS (
        SELECT 1
        FROM scenario_questions sq
        WHERE sq.scenario_id = api_save_question_timestamps_v4.scenario_id
        AND sq.question_id = questions.id
        AND sq.active = true
    )
    RETURNING 1
)
SELECT COUNT(*)::int as updated_count FROM update_question_times
$$;