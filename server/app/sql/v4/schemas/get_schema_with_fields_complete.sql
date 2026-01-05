-- Get schema with all fields (including nested via schema_field_items)
-- Returns schema fields in a format compatible with template schema structure
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_schema_with_fields_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_schema_with_fields_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_schema_with_fields_v4(
    schema_id uuid
)
RETURNS TABLE (
    schema_id uuid,
    field_id uuid,
    field_name text,
    field_type schema_field_type,
    required boolean,
    "position" integer,
    item_schema_id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT
    s.id as schema_id,
    sf.id as field_id,
    sf.name as field_name,
    sf.field_type,
    sf.required,
    sf."position",
    sfi.item_schema_id
FROM schemas s
JOIN schema_fields sf ON sf.schema_id = s.id
LEFT JOIN schema_field_items sfi ON sfi.schema_field_id = sf.id
WHERE s.id = $1
ORDER BY sf."position", sf.name
$$;

