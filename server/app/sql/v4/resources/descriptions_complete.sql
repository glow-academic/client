-- Create descriptions resource
-- Always INSERT operation (preserves all information)
-- Parameters: description (text)
-- Returns: description_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_descriptions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_descriptions_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_descriptions_v4(
    description text
)
RETURNS TABLE (
    description_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_description_id uuid;
BEGIN
    -- INSERT into descriptions table (always insert, never update)
    INSERT INTO descriptions(description, active)
    VALUES (description, true)
    RETURNING id INTO v_description_id;
    
    RETURN QUERY SELECT v_description_id;
END;
$$;
