-- Create answers linking questions to options
-- Converted to PostgreSQL function
-- Each answer represents that an option is correct for a question
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_answers_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_answers_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_create_answers_v4(
    answers_json jsonb,
    scenario_id uuid
)
RETURNS TABLE (
    answer_id uuid,
    question_id uuid,
    option_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
WITH answers_data AS (
    -- Parse answers from JSON
    SELECT 
        (ans->>'question_id')::uuid as question_id,
        (ans->>'option_id')::uuid as option_id
    FROM jsonb_array_elements(answers_json) as ans
    WHERE ans->>'question_id' IS NOT NULL 
      AND ans->>'option_id' IS NOT NULL
),
create_answers AS (
    -- Create answers as strong entities
    INSERT INTO answers (question_id, option_id, active, created_at, updated_at)
    SELECT DISTINCT
        ad.question_id,
        ad.option_id,
        true,
        NOW(),
        NOW()
    FROM answers_data ad
    WHERE EXISTS (SELECT 1 FROM questions q WHERE q.id = ad.question_id AND q.active = true)
      AND EXISTS (SELECT 1 FROM options o WHERE o.id = ad.option_id AND o.active = true)
    ON CONFLICT (question_id, option_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
    RETURNING id::uuid as answer_id, question_id, option_id
),
link_scenario_answers AS (
    -- Link answers to scenario via junction table
    INSERT INTO scenario_answers (scenario_id, answer_id, active, created_at, updated_at)
    SELECT 
        scenario_id,
        ca.answer_id,
        true,
        NOW(),
        NOW()
    FROM create_answers ca
    ON CONFLICT (scenario_id, answer_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT DISTINCT
    ca.answer_id,
    ca.question_id,
    ca.option_id
FROM create_answers ca
ORDER BY ca.answer_id
$$;

