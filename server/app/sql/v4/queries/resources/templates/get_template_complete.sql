-- Get template resource by ID
-- Simple data fetching for scenario two-pass architecture
-- Parameters: id (uuid)
-- Returns: item (single template resource)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_template_resource_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_template_resource_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_template_resource_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for template item
CREATE TYPE types.q_get_template_resource_v4_item AS (
    template_id uuid,
    name text,
    description text,
    html text,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_template_resource_v4(
    id uuid
)
RETURNS TABLE (
    item types.q_get_template_resource_v4_item
)
LANGUAGE sql
STABLE
AS $$
SELECT
    (
        t.id,
        t.name,
        COALESCE(t.description, ''),
        COALESCE(t.html, ''),
        COALESCE(t.generated, false)
    )::types.q_get_template_resource_v4_item as item
FROM templates_resource t
WHERE t.id = id
  AND t.active = true;
$$;
