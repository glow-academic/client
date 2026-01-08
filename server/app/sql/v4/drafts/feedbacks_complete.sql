-- Create/update feedbacks resource and link to draft
-- Always INSERT operation (preserves all information)
-- Parameters: draft_id (uuid), total (uuid), feedback (uuid), standard_id (uuid)
-- Returns: feedback_id (uuid), version (int)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_draft_feedbacks_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_draft_feedbacks_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_draft_feedbacks_v4(
    draft_id uuid, total numeric, feedback text, standard_id uuid
)
RETURNS TABLE (
    feedback_id uuid,
    version int
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_feedback_id uuid;
    v_version int;
BEGIN
    -- Get draft version
    SELECT d.version INTO v_version
    FROM drafts d
    WHERE d.id = draft_id;
    
    IF v_version IS NULL THEN
        RAISE EXCEPTION 'Draft not found: %', draft_id;
    END IF;
    
    -- INSERT into feedbacks table (always insert, never update)
    INSERT INTO feedbacks(total, feedback, standard_id, active)
    VALUES (total, feedback, standard_id, true)
    RETURNING id INTO v_feedback_id;
    
    -- INSERT into draft_feedbacks junction table (always insert, never update)
    INSERT INTO draft_feedbacks(draft_id, feedback_id, version)
    VALUES (draft_id, v_feedback_id, v_version)
    ON CONFLICT (draft_id, feedback_id) DO UPDATE
    SET version = v_version,
        updated_at = now();
    
    RETURN QUERY SELECT v_feedback_id, v_version;
END;
$$;
