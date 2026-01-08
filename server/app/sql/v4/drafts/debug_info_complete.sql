-- Create/update debug_info resource and link to draft
-- Always INSERT operation (preserves all information)
-- Parameters: draft_id (uuid), content (text)
-- Returns: debug_info_id (uuid), version (int)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_draft_debug_info_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_draft_debug_info_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_draft_debug_info_v4(
    draft_id uuid, content text
)
RETURNS TABLE (
    debug_info_id uuid,
    version int
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_debug_info_id uuid;
    v_version int;
BEGIN
    -- Get draft version
    SELECT d.version INTO v_version
    FROM drafts d
    WHERE d.id = draft_id;
    
    IF v_version IS NULL THEN
        RAISE EXCEPTION 'Draft not found: %', draft_id;
    END IF;
    
    -- INSERT into debug_info table (always insert, never update)
    INSERT INTO debug_info(content, active)
    VALUES (content, true)
    RETURNING id INTO v_debug_info_id;
    
    -- INSERT into draft_debug_info junction table (always insert, never update)
    INSERT INTO draft_debug_info(draft_id, debug_info_id, version)
    VALUES (draft_id, v_debug_info_id, v_version)
    ON CONFLICT (draft_id, debug_info_id) DO UPDATE
    SET version = v_version,
        updated_at = now();
    
    RETURN QUERY SELECT v_debug_info_id, v_version;
END;
$$;
