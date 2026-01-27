-- Get departments resources by IDs
-- Simple data fetching - no business logic
-- Parameters: ids (uuid[])
-- Returns: items (array of department resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_departments_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_departments_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop search function if exists (avoids type dependency conflicts)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_departments_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_departments_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_departments_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for department item
CREATE TYPE types.q_get_departments_v4_item AS (
    department_id uuid,
    name text,
    description text,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_departments_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_departments_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            d.id,
            (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = ddj.department_id LIMIT 1),
            COALESCE((SELECT d2.description FROM department_descriptions_junction dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = ddj.department_id LIMIT 1), ''),
            COALESCE(d.generated, false)
        )::types.q_get_departments_v4_item
        ORDER BY array_position(ids, d.id)
    ),
    ARRAY[]::types.q_get_departments_v4_item[]
) as items
FROM departments_resource d
JOIN department_departments_junction ddj ON ddj.departments_id = d.id
WHERE d.id = ANY(ids)
  AND EXISTS (
      SELECT 1 FROM department_flags_junction df
      JOIN flags_resource f ON df.flag_id = f.id
      -- NOTE: Flags are on department_artifact (ddj.department_id), not departments_resource (d.id)
      WHERE df.department_id = ddj.department_id
        AND f.name = 'department_active'
        AND df.value = true
  )
;
$$;
