-- Link a question to a scenario
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_link_questions_to_scenario_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_link_questions_to_scenario_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_link_questions_to_scenario_v4(
    scenario_id uuid,
    question_id uuid,
    active boolean
)
RETURNS TABLE (
    question_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
INSERT INTO scenario_questions (scenario_id, question_id, active, created_at, updated_at)
VALUES (scenario_id, question_id, active, NOW(), NOW())
ON CONFLICT (scenario_id, question_id) DO UPDATE SET
    active = EXCLUDED.active,
    updated_at = NOW()
RETURNING question_id
$$;