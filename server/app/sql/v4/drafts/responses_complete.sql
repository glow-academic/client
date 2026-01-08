-- Create/update responses resource and link to draft
-- Always INSERT operation (preserves all information)
-- Parameters: draft_id (uuid), option_id (uuid), question_id (uuid)
-- Returns: response_id (uuid), version (int)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_draft_responses_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_draft_responses_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_draft_responses_v4(
    draft_id uuid, option_id uuid, question_id uuid
)
RETURNS TABLE (
    response_id uuid,
    version int
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_response_id uuid;
    v_version int;
BEGIN
    -- Get draft version
    SELECT d.version INTO v_version
    FROM drafts d
    WHERE d.id = draft_id;
    
    IF v_version IS NULL THEN
        RAISE EXCEPTION 'Draft not found: %', draft_id;
    END IF;
    
    -- INSERT into responses table (always insert, never update)
    INSERT INTO responses(option_id, question_id, active)
    VALUES (option_id, question_id, true)
    RETURNING id INTO v_response_id;
    
    -- INSERT into draft_responses junction table (always insert, never update)
    INSERT INTO draft_responses(draft_id, response_id, version)
    VALUES (draft_id, v_response_id, v_version)
    ON CONFLICT (draft_id, response_id) DO UPDATE
    SET version = v_version,
        updated_at = now();
    
    RETURN QUERY SELECT v_response_id, v_version;
END;
$$;
