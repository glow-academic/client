-- Link profiles resource (tool call tracking for non-creatable resources)
-- Records a tool call linking an existing profiles resource to a run/call chain
-- Parameters: resources_id (uuid), group_id (uuid), tool_id (uuid)
-- Returns: resources_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_link_profiles_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_link_profiles_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_link_profiles_v4(
    resources_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    tool_id uuid DEFAULT NULL
)
RETURNS TABLE (
    profiles_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_call_id uuid;
    v_run_id uuid;
BEGIN
    -- Validate resource exists
    IF resources_id IS NULL THEN
        RAISE EXCEPTION 'resources_id is required';
    END IF;

    -- If tool_id and group_id provided, create run and call for tracking
    IF tool_id IS NOT NULL AND group_id IS NOT NULL THEN
        -- Create run record
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, api_link_profiles_v4.group_id, NOW(), NOW());

        -- Create call record
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
        VALUES (v_call_id, 'profiles_' || v_call_id::text, v_run_id, NOW());

        -- Link tool to call
        INSERT INTO tools_calls_connection (tools_id, call_id)
        VALUES (api_link_profiles_v4.tool_id, v_call_id);

        -- Link resource to call
        INSERT INTO profiles_calls_connection (profiles_id, call_id)
        VALUES (api_link_profiles_v4.resources_id, v_call_id);
    END IF;

    RETURN QUERY SELECT api_link_profiles_v4.resources_id;
END;
$$;
