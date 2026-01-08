-- Create improvements resource
-- Always INSERT operation (preserves all information)
-- Parameters: name text, description text, message_id uuid
-- Returns: improvement_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_improvements_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_improvements_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_improvements_v4(
    name text, description text, message_id uuid
)
RETURNS TABLE (
    improvement_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_improvement_id uuid;
BEGIN
    -- INSERT into improvements table (always insert, never update)
    INSERT INTO improvements(name, description, message_id, active)
    VALUES (name, description, message_id, true)
    RETURNING id INTO v_improvement_id;

    RETURN QUERY SELECT v_improvement_id;
END;
$$;