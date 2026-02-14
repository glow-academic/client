-- Create uploads resource
-- SIMPLIFIED: No agent_id required, optional tool_id for tracking
-- Get or create operation (returns existing ID if upload_id already exists)
-- Parameters: upload_id (uuid), mcp (boolean), group_id (uuid, optional), tool_id (uuid, optional)
-- Returns: uploads_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_uploads_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_uploads_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_uploads_v4(
    upload_id uuid,
    mcp boolean DEFAULT false,
    group_id uuid DEFAULT NULL,
    tool_id uuid DEFAULT NULL
)
RETURNS TABLE (
    uploads_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_uploads_id uuid;
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    -- Validate upload_id exists
    IF NOT EXISTS (SELECT 1 FROM uploads_entry WHERE id = upload_id) THEN
        RAISE EXCEPTION 'Upload % does not exist', upload_id;
    END IF;

    -- Check if uploads_resource entry already exists for this upload_id
    SELECT id INTO v_uploads_id
    FROM uploads_resource
    WHERE upload_id = api_create_uploads_v4.upload_id
    LIMIT 1;

    -- If exists, return existing ID
    IF v_uploads_id IS NOT NULL THEN
        RETURN QUERY SELECT v_uploads_id;
        RETURN;
    END IF;

    -- INSERT INTO uploads_resource table
    INSERT INTO uploads_resource(upload_id, active, mcp)
    VALUES (api_create_uploads_v4.upload_id, true, mcp)
    RETURNING id INTO v_uploads_id;
    -- If tool_id and group_id provided, create run and call for tracking
    IF tool_id IS NOT NULL AND group_id IS NOT NULL THEN
        -- Create run record
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, input_tokens, output_tokens, cached_input_tokens, group_id, created_at, updated_at)
        VALUES (v_run_id, 0, 0, 0, api_create_uploads_v4.group_id, NOW(), NOW());

        -- Create call record
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
        VALUES (v_call_id, 'uploads_' || v_call_id::text, v_run_id, true, NOW(), NOW());

        -- Link tool to call
        INSERT INTO tools_calls_connection (tools_id, call_id) VALUES (api_create_uploads_v4.tool_id, v_call_id);

        -- Link resource to call
        INSERT INTO uploads_calls_connection (uploads_id, call_id)
        VALUES (v_uploads_id, v_call_id);
    END IF;

    RETURN QUERY SELECT v_uploads_id;
END;
$$;
