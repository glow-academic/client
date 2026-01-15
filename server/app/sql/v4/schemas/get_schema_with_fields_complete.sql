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
-- schema_id is now args_resource.id - but since each args_resource is a single field,
-- we return just that one field (no aggregation needed)
-- Note: schema_field_items_resource has been dropped, so item_schema_id is always NULL
SELECT
    ar.id as schema_id,
    ar.id as field_id,  -- Same as schema_id since each args_resource is one field
    ar.name as field_name,
    ar.field_type::schema_field_type,  -- Cast to maintain return type
    ar.required,
    ar.position,
    NULL::uuid as item_schema_id  -- schema_field_items_resource dropped
FROM args_resource ar
WHERE ar.id = $1
ORDER BY ar.position, ar.name
$$;

