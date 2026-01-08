-- Get draft metadata
-- Parameters: as=draft_id (uuid)
-- Returns: draft_id (uuid), artifact (artifacts), version (int), created_at (timestamptz), updated_at (timestamptz)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_draft_v4(
    draft_id uuid
)
RETURNS TABLE (
    draft_id uuid,
    artifact artifacts,
    version int,
    created_at timestamptz,
    updated_at timestamptz,
    draft_exists boolean
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        d.id AS draft_id,
        d.artifact,
        d.version,
        d.created_at,
        d.updated_at,
        true AS draft_exists
    FROM drafts d
    WHERE d.id = draft_id;
$$;
