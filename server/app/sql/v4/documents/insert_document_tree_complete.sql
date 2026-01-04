-- Insert document_tree junction record
-- Converted to PostgreSQL function
-- Links a parent document to a child document
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_insert_document_tree_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_insert_document_tree_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_insert_document_tree_v4(
    parent_id uuid,
    child_id uuid,
    active boolean
)
RETURNS TABLE (
    parent_id uuid,
    child_id uuid,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
INSERT INTO document_tree (parent_id, child_id, active, created_at, updated_at)
VALUES (api_insert_document_tree_v4.parent_id, api_insert_document_tree_v4.child_id, api_insert_document_tree_v4.active, NOW(), NOW())
ON CONFLICT (parent_id, child_id) DO UPDATE SET
    active = EXCLUDED.active,
    updated_at = NOW()
RETURNING parent_id, child_id, active, created_at, updated_at
$$;