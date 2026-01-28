-- Get drafts by IDs
-- Simple data fetching for profile context 2-pass architecture
-- Parameters: ids (uuid[])
-- Returns: items (array of draft entries)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_drafts_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_drafts_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_drafts_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for draft item
CREATE TYPE types.q_get_drafts_v4_item AS (
    id uuid,
    artifact_type text,
    payload jsonb,
    version int,
    updated_at timestamptz
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_drafts_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_drafts_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            d.id,
            d.artifact::text,
            NULL::jsonb,
            d.version,
            d.updated_at
        )::types.q_get_drafts_v4_item
        ORDER BY d.updated_at DESC
    ),
    ARRAY[]::types.q_get_drafts_v4_item[]
) as items
FROM view_drafts_entry d
WHERE d.id = ANY(ids);
$$;
