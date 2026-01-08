-- Create analyses resource
-- Always INSERT operation (preserves all information)
-- Parameters: content text
-- Returns: analyse_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_analyses_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_analyses_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_analyses_v4(
    content text
)
RETURNS TABLE (
    analyse_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_analyse_id uuid;
BEGIN
    -- INSERT into analyses table (always insert, never update)
    INSERT INTO analyses(content, active)
    VALUES (content, true)
    RETURNING id INTO v_analyse_id;

    RETURN QUERY SELECT v_analyse_id;
END;
$$;