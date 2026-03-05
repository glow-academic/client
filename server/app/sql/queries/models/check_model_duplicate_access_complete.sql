-- Model Duplicate Access Check
-- Returns user role for Python to compute duplicate permissions
-- Also returns original model name for Python to create the copy name

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_model_duplicate_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_model_duplicate_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_model_duplicate_access_v4(
    profile_id uuid,
    model_id uuid DEFAULT NULL
)
RETURNS TABLE (
    -- User context for Python permission logic
    user_role text,
    original_name text
)
LANGUAGE sql
STABLE
AS $$
-- User context (role, actor_name, department_ids) comes from get_profile_context_internal() in Python
SELECT
    true::text as user_role,
    (SELECT n.name FROM model_names_junction mn JOIN names_resource n ON mn.names_id = n.id WHERE mn.model_id = api_check_model_duplicate_access_v4.model_id LIMIT 1) as original_name;
$$;
