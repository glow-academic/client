-- Validate simulation resource progress - no-op function for validation only
-- Validates artifact_type and resource_type for simulation progress events
-- Uses safe drop/recreate pattern
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_validate_simulation_resource_progress_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_validate_simulation_resource_progress_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_validate_simulation_resource_progress_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Create function (no-op - validation only)
CREATE OR REPLACE FUNCTION api_validate_simulation_resource_progress_v4(
    profile_id uuid,
    group_id uuid,
    resource_type text,
    artifact_type text
)
RETURNS TABLE (
    is_valid boolean
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    valid_simulation_resource_types text[] := ARRAY['names', 'descriptions', 'departments', 'flags', 'scenarios', 'scenario_flags', 'scenario_positions', 'scenario_rubric_grade_agents'];
BEGIN
    -- Validate artifact_type (all validation in SQL)
    IF artifact_type != 'simulation' THEN
        RAISE EXCEPTION 'Invalid artifact_type: expected "simulation", got "%"', artifact_type;
    END IF;
    
    -- Validate resource_type
    IF resource_type != ALL(valid_simulation_resource_types) THEN
        RAISE EXCEPTION 'Invalid resource_type: "%" is not a valid simulation resource type', resource_type;
    END IF;
    
    -- Return validation result (no database queries)
    RETURN QUERY
    SELECT TRUE as is_valid;
END;
$$;
