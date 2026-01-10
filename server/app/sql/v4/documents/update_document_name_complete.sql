-- Update document name
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_update_document_name_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_update_document_name_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_update_document_name_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate function
CREATE OR REPLACE FUNCTION socket_update_document_name_v4(
    document_id uuid,
    name text
)
RETURNS TABLE (
    document_id uuid,
    name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT $1 as document_id, $2 as name
),
-- Insert/update name in names table
name_resource AS (
    INSERT INTO names (name, created_at, updated_at)
    SELECT name, NOW(), NOW()
    FROM params
    WHERE name IS NOT NULL AND name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Update document (without name column)
document_update AS (
    UPDATE document
    SET updated_at = NOW()
    WHERE id = (SELECT document_id FROM params)
    RETURNING id as document_id
),
-- Remove old name links
remove_old_name AS (
    DELETE FROM document_names
    WHERE document_id = (SELECT document_id FROM params)
      AND name_id NOT IN (SELECT name_id FROM name_resource)
),
-- Link document to new name
link_document_name AS (
    INSERT INTO document_names (document_id, name_id, created_at, updated_at)
    SELECT 
        du.document_id,
        nr.name_id,
        NOW(),
        NOW()
    FROM document_update du
    CROSS JOIN name_resource nr
    ON CONFLICT (document_id, name_id) DO UPDATE SET updated_at = NOW()
)
SELECT 
    du.document_id,
    (SELECT n.name FROM names n JOIN name_resource nr ON n.id = nr.name_id LIMIT 1) as name
FROM document_update du
$$;