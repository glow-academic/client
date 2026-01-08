-- Create objectives resource
-- Always INSERT operation (preserves all information)
-- Parameters: objective (text)
-- Returns: objective_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_objectives_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_objectives_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_objectives_v4(
    objective text
)
RETURNS TABLE (
    objective_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_objective_id uuid;
BEGIN
    -- INSERT into objectives table (always insert, never update)
    INSERT INTO objectives(objective, active)
    VALUES (objective, true)
    RETURNING id INTO v_objective_id;
    
    RETURN QUERY SELECT v_objective_id;
END;
$$;
