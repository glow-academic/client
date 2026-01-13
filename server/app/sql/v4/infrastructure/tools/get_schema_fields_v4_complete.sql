-- Get schema fields for a schema
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'infrastructure_tools_get_schema_fields_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infrastructure_tools_get_schema_fields_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION infrastructure_tools_get_schema_fields_v4(
    schema_id uuid
)
RETURNS TABLE (
    id uuid,
    name text,
    field_type text,
    template text
)
LANGUAGE sql
STABLE
AS $$
    SELECT id, name, field_type, template
    FROM schema_fields
    WHERE schema_fields.schema_id = $1
    ORDER BY position
$$;
