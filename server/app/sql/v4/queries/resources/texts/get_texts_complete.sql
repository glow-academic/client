-- Get texts resources by IDs (batch)
-- Simple data fetching - query texts_resource + texts_texts_connection only
-- Parameters: p_ids (uuid[])
-- Returns: items (array of text resources with text_id from connection)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_texts_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_texts_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop search function that depends on types (must happen before type drop)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_texts_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_texts_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_texts_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for text item (text_id from connection, no content)
CREATE TYPE types.q_get_texts_v4_item AS (
    texts_id uuid,
    text_id uuid,
    generated boolean
);

-- Create function - query texts_resource + texts_texts_connection only
CREATE OR REPLACE FUNCTION api_get_texts_v4(
    p_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_texts_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            tr.id,
            ttc.text_id,
            COALESCE(tr.generated, false)
        )::types.q_get_texts_v4_item
        ORDER BY array_position(p_ids, tr.id)
    ),
    ARRAY[]::types.q_get_texts_v4_item[]
) as items
FROM texts_resource tr
LEFT JOIN texts_texts_connection ttc ON ttc.texts_id = tr.id AND ttc.active = true
WHERE tr.id = ANY(p_ids);
$$;
