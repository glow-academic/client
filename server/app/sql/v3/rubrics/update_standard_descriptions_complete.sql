-- Update standard descriptions for rubric grid cells
-- Converted to PostgreSQL function with composite types
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
        WHERE proname = 'socket_update_standard_descriptions_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_update_standard_descriptions_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'i_update_standard_descriptions_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.i_update_standard_descriptions_v3_description AS (
    standard_group_id uuid,
    standard_id uuid,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION socket_update_standard_descriptions_v3(
    rubric_id uuid,
    descriptions types.i_update_standard_descriptions_v3_description[],
    profile_id uuid
)
RETURNS TABLE (
    updated_count int
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT rubric_id AS rubric_id, descriptions AS descriptions, profile_id AS profile_id
),
descriptions_data AS (
    -- Unnest descriptions array (composite type array)
    SELECT 
        (unnest(descriptions)).standard_group_id,
        (unnest(descriptions)).standard_id,
        (unnest(descriptions)).description
    FROM (SELECT descriptions FROM params) as d
),
updated_standards AS (
    UPDATE standards s
    SET description = dd.description
    FROM descriptions_data dd
    WHERE s.id = dd.standard_id
      AND s.standard_group_id = dd.standard_group_id
      AND EXISTS (
          SELECT 1 FROM standard_groups sg
          WHERE sg.id = s.standard_group_id
          AND sg.rubric_id = (SELECT rubric_id FROM params)
      )
    RETURNING s.id
)
SELECT COUNT(*)::int as updated_count
FROM updated_standards
$$;

COMMIT;

