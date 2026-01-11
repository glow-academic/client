-- Get agent end event name for an artifact type
-- Checks if artifact_type is a valid value in the artifacts enum
-- Returns {artifact_type}_end if artifact exists, otherwise returns default

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
    artifact_type text
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
    -- Check if artifact_type is a valid artifacts enum value
    IF EXISTS (
        SELECT 1 FROM unnest(enum_range(NULL::artifacts)) AS e
        WHERE e::text = artifact_type
    ) THEN
        v_event_name := artifact_type || '_end';
        RETURN QUERY SELECT v_event_name;
        RETURN;
    END IF;
    
    -- Special case: audio maps to voice
    IF artifact_type = 'audio' THEN
        RETURN QUERY SELECT 'voice_end'::text;
        RETURN;
    END IF;
    
    -- Default fallback
    RETURN QUERY SELECT 'text_end'::text;
END;
$$;
