-- Create schemas resource
-- Always INSERT operation (preserves all information)
-- Parameters: 
-- Returns: schema_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_schemas_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_schemas_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_schemas_v4()
RETURNS TABLE (
    schema_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_schema_id uuid;
BEGIN
    -- INSERT into schemas table (always insert, never update)
    INSERT INTO schemas(active)
    VALUES (true)
    RETURNING id INTO v_schema_id;

    RETURN QUERY SELECT v_schema_id;
END;
$$;