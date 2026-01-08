-- Create draft
-- Parameters: as=artifact (artifacts enum), a=profile_id (uuid)
-- Returns: draft_id (uuid), version (int)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_draft_v4(
    artifact artifacts,
    profile_id uuid
)
RETURNS TABLE (
    draft_id uuid,
    version int
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO drafts(artifact, profile_id, version)
    VALUES (artifact, profile_id, 0)
    RETURNING id AS draft_id, version;
$$;
