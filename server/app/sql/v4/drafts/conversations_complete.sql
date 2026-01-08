-- Create/update conversations resource and link to draft
-- Always INSERT operation (preserves all information)
-- Parameters: draft_id (uuid), end_reason (text)
-- Returns: conversation_id (uuid), version (int)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_draft_conversations_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_draft_conversations_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_draft_conversations_v4(
    draft_id uuid, end_reason text
)
RETURNS TABLE (
    conversation_id uuid,
    version int
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_conversation_id uuid;
    v_version int;
BEGIN
    -- Get draft version
    SELECT d.version INTO v_version
    FROM drafts d
    WHERE d.id = draft_id;
    
    IF v_version IS NULL THEN
        RAISE EXCEPTION 'Draft not found: %', draft_id;
    END IF;
    
    -- INSERT into conversations table (always insert, never update)
    INSERT INTO conversations(end_reason, active)
    VALUES (end_reason, true)
    RETURNING id INTO v_conversation_id;
    
    -- INSERT into draft_conversations junction table (always insert, never update)
    INSERT INTO draft_conversations(draft_id, conversation_id, version)
    VALUES (draft_id, v_conversation_id, v_version)
    ON CONFLICT (draft_id, conversation_id) DO UPDATE
    SET version = v_version,
        updated_at = now();
    
    RETURN QUERY SELECT v_conversation_id, v_version;
END;
$$;
