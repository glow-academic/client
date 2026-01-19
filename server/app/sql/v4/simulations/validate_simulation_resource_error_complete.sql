-- Validate simulation resource error - no-op function for validation only
-- Validates artifact_type and resource_type/resource_types for simulation error events
-- Uses safe drop/recreate pattern
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_validate_simulation_resource_error_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_validate_simulation_resource_error_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_validate_simulation_resource_error_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Create function (no-op - validation only)
CREATE OR REPLACE FUNCTION api_validate_simulation_resource_error_v4(
    profile_id uuid,
    group_id uuid,
    resource_type text,
    resource_types text[],
    artifact_type text
)
RETURNS TABLE (
    is_valid boolean
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    valid_simulation_resource_types text[] := ARRAY['names', 'descriptions', 'departments', 'flags', 'scenarios', 'scenario_flags', 'scenario_positions', 'scenario_rubrics'];
    is_simulation_resource boolean := FALSE;
BEGIN
    -- Validate artifact_type (all validation in SQL)
    IF artifact_type != 'simulation' THEN
        RAISE EXCEPTION 'Invalid artifact_type: expected "simulation", got "%"', artifact_type;
    END IF;
    
    -- Check if resource_type is valid (if provided and not empty)
    IF resource_type IS NOT NULL AND resource_type != '' THEN
        IF resource_type = ANY(valid_simulation_resource_types) THEN
            is_simulation_resource := TRUE;
        END IF;
    END IF;
    
    -- Check if any item in resource_types array is valid (if provided and not already found)
    IF NOT is_simulation_resource AND resource_types IS NOT NULL AND array_length(resource_types, 1) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM unnest(resource_types) AS rt
            WHERE rt = ANY(valid_simulation_resource_types)
        ) THEN
            is_simulation_resource := TRUE;
        END IF;
    END IF;
    
    -- Validate that at least one valid simulation resource type was found
    IF NOT is_simulation_resource THEN
        RAISE EXCEPTION 'Invalid resource_type/resource_types: no valid simulation resource type found';
    END IF;
    
    -- Return validation result (no database queries)
    RETURN QUERY
    SELECT TRUE as is_valid;
END;
$$;
