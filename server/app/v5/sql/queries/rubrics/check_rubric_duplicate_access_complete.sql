-- Rubric Duplicate Access Check
-- Returns rubric_exists for Python to validate before duplicate

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_rubric_duplicate_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_rubric_duplicate_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_rubric_duplicate_access_v4(
    profile_id uuid,
    rubric_id uuid
)
RETURNS TABLE (
    rubric_exists boolean
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id, rubric_id AS rubric_id
),
rubric_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM rubric_artifact WHERE id = (SELECT rubric_id FROM params)
    )::boolean as rubric_exists
)
SELECT (SELECT rubric_exists FROM rubric_exists_check) as rubric_exists
FROM params x
$$;
