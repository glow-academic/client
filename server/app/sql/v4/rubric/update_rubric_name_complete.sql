-- Update rubric name
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

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
    UPDATE rubrics
    SET name = socket_update_rubric_name_v4.name,
        updated_at = NOW()
    WHERE id = socket_update_rubric_name_v4.rubric_id
    RETURNING id as rubric_id, name
$$;

COMMIT;

