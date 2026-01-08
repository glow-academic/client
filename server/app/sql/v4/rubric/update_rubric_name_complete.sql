-- Update rubric name
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
        WHERE proname = 'socket_update_rubric_name_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_update_rubric_name_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE (if any)
-- Drop all types matching prefix pattern to handle type additions/removals
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'i_update_rubric_name_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate function (no types needed for this simple function)
CREATE OR REPLACE FUNCTION socket_update_rubric_name_v4(
    profile_id uuid,
    rubric_id uuid,
    name text
)
RETURNS TABLE (
    rubric_id uuid,
    name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH get_or_create_name AS (
    -- Get or create name in names table
    INSERT INTO names (name, created_at, updated_at)
    SELECT socket_update_rubric_name_v4.name, NOW(), NOW()
    WHERE socket_update_rubric_name_v4.name IS NOT NULL AND socket_update_rubric_name_v4.name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id, name as name_value
),
update_rubric_name AS (
    -- Update rubric name (delete old, insert new)
    DELETE FROM rubric_names
    WHERE rubric_id = socket_update_rubric_name_v4.rubric_id
    RETURNING rubric_id
),
link_rubric_name AS (
    -- Link new name to rubric
    INSERT INTO rubric_names (rubric_id, name_id, created_at, updated_at)
    SELECT socket_update_rubric_name_v4.rubric_id, gocn.name_id, NOW(), NOW()
    FROM get_or_create_name gocn
    WHERE gocn.name_id IS NOT NULL
),
update_rubric AS (
    UPDATE rubrics
    SET updated_at = NOW()
    WHERE id = socket_update_rubric_name_v4.rubric_id
    RETURNING id as rubric_id
)
SELECT ur.rubric_id, COALESCE(gocn.name_value, (SELECT n.name FROM rubric_names rn JOIN names n ON rn.name_id = n.id WHERE rn.rubric_id = ur.rubric_id LIMIT 1)) as name
FROM update_rubric ur
LEFT JOIN get_or_create_name gocn ON true
$$;