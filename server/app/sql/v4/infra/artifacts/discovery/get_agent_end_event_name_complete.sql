-- Get agent end event name for a resource type
-- Checks if resource_type matches an artifact name in the artifacts table
-- Returns {resource_type}_end if artifact exists, otherwise returns default

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_agent_end_event_name_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_agent_end_event_name_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_agent_end_event_name_v4(
    resource_type text
)
RETURNS TABLE (
    event_name text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_event_name text;
BEGIN
    -- Check if resource_type matches an artifact name
    IF EXISTS (
        SELECT 1 FROM artifacts
        WHERE name = resource_type
    ) THEN
        v_event_name := resource_type || '_end';
        RETURN QUERY SELECT v_event_name;
        RETURN;
    END IF;
    
    -- Special case: audio maps to voice
    IF resource_type = 'audio' THEN
        RETURN QUERY SELECT 'voice_end'::text;
        RETURN;
    END IF;
    
    -- Default fallback
    RETURN QUERY SELECT 'text_end'::text;
END;
$$;
