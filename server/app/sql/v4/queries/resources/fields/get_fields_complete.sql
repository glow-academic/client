-- Get fields resources by IDs
-- Simple data fetching - no business logic
-- Parameters: ids (uuid[]), search (text, optional)
-- Returns: items (array of field resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_fields_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_fields_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_fields_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for field item
CREATE TYPE types.q_get_fields_v4_item AS (
    field_id uuid,
    name text,
    description text,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_fields_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[],
    search text DEFAULT NULL
)
RETURNS TABLE (
    items types.q_get_fields_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            f.id,
            (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = ffj.field_id LIMIT 1),
            COALESCE((SELECT d.description FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = ffj.field_id LIMIT 1), ''),
            COALESCE(f.generated, false)
        )::types.q_get_fields_v4_item
        ORDER BY array_position(ids, f.id)
    ),
    ARRAY[]::types.q_get_fields_v4_item[]
) as items
FROM fields_resource f
JOIN field_fields_junction ffj ON ffj.fields_id = f.id
WHERE f.id = ANY(ids)
  AND EXISTS (
      SELECT 1 FROM field_flags_junction ff
      JOIN flags_resource fl ON ff.flag_id = fl.id
      WHERE ff.field_id = ffj.field_id
        AND fl.name = 'field_active'
        AND ff.value = true
  )
  AND (search IS NULL OR search = '' OR
       LOWER((SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = ffj.field_id LIMIT 1)) LIKE '%' || LOWER(search) || '%');
$$;
