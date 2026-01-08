-- Create examples resource
-- Always INSERT operation (preserves all information)
-- Parameters: example (text)
-- Returns: example_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_examples_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_examples_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_examples_v4(
    example text
)
RETURNS TABLE (
    example_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_example_id uuid;
BEGIN
    -- INSERT into examples table (always insert, never update)
    INSERT INTO examples(example, active)
    VALUES (example, true)
    RETURNING id INTO v_example_id;
    
    RETURN QUERY SELECT v_example_id;
END;
$$;
