-- Create hints resource
-- Always INSERT operation (preserves all information)
-- Parameters: hint text
-- Returns: hint_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_hints_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_hints_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_hints_v4(
    hint text
)
RETURNS TABLE (
    hint_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_hint_id uuid;
BEGIN
    -- INSERT into hints table (always insert, never update)
    INSERT INTO hints(hint, active)
    VALUES (hint, true)
    RETURNING id INTO v_hint_id;

    RETURN QUERY SELECT v_hint_id;
END;
$$;