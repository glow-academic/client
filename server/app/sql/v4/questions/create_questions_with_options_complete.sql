-- Create questions and their options, return question IDs
-- Converted to PostgreSQL function
-- Note: Uses JSONB - may need refactoring per STANDARDS.md
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_questions_with_options_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_questions_with_options_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_create_questions_with_options_v4(
    questions_json jsonb
)
RETURNS TABLE (
    question_id uuid,
    question_text text,
    allow_multiple boolean
)
LANGUAGE sql
VOLATILE
AS $$
WITH questions_data AS (
    -- Parse questions from JSON
    SELECT 
        q->>'question_text' as question_text,
        q->>'type' as question_type,
        COALESCE((q->>'allow_multiple')::boolean, false) as allow_multiple,
        q->'options' as options_json
    FROM jsonb_array_elements(questions_json) as q
),
create_questions AS (
    -- Create questions (or get existing if they match exactly)
    -- Note: time column is required, default to 0 (will be updated via save_question_timestamps)
    INSERT INTO questions_resource (question_text, allow_multiple, time, active, created_at, updated_at)
    SELECT DISTINCT
        qd.question_text,
        qd.allow_multiple,
        0 as time,  -- Default to 0, will be updated via save_question_timestamps if provided
        true,
        NOW(),
        NOW()
    FROM questions_data qd
    WHERE qd.question_text IS NOT NULL AND qd.question_text != ''
    ON CONFLICT DO NOTHING
    RETURNING id::uuid as question_id, question_text, allow_multiple
),
get_existing_questions AS (
    -- Get existing questions that match
    SELECT 
        q.id as question_id,
        q.question_text,
        q.allow_multiple
    FROM questions_resource q
    JOIN questions_data qd ON q.question_text = qd.question_text 
        AND q.allow_multiple = qd.allow_multiple
    WHERE q.active = true
),
all_questions AS (
    SELECT * FROM create_questions
    UNION
    SELECT * FROM get_existing_questions
),
options_data AS (
    -- Extract options FROM questions_resource (only for choice questions)
    SELECT 
        aq.question_id,
        opt->>'option_text' as option_text,
        COALESCE((opt->>'is_correct')::boolean, false) as is_correct
    FROM all_questions aq
    JOIN questions_data qd ON aq.question_text = qd.question_text 
        AND aq.allow_multiple = qd.allow_multiple
    CROSS JOIN jsonb_array_elements(qd.options_json) as opt
    WHERE qd.question_type = 'choice' AND qd.options_json IS NOT NULL
),
create_options AS (
    -- Create options with is_correct (reusable across questions)
    -- If same option_text appears with different is_correct values, prefer true
    INSERT INTO options_resource (option_text, is_correct, active, created_at, updated_at)
    SELECT DISTINCT ON (od.option_text)
        od.option_text,
        BOOL_OR(od.is_correct) as is_correct,  -- If any instance is true, set to true
        true,
        NOW(),
        NOW()
    FROM options_data od
    WHERE od.option_text IS NOT NULL AND od.option_text != ''
    GROUP BY od.option_text
    ON CONFLICT DO NOTHING
    RETURNING id::uuid as option_id, option_text
),
get_existing_options AS (
    -- Get existing options that match
    SELECT 
        o.id as option_id,
        o.option_text
    FROM options_resource o
    JOIN options_data od ON o.option_text = od.option_text
    WHERE o.active = true
),
all_options AS (
    SELECT * FROM create_options
    UNION
    SELECT * FROM get_existing_options
)
-- Note: Answers are no longer created here. Correctness (is_correct) is now stored
-- in the options table itself, not in scenario_options or a separate answers table.
SELECT DISTINCT
    aq.question_id,
    aq.question_text,
    aq.allow_multiple
FROM all_questions aq
ORDER BY aq.question_id
$$;