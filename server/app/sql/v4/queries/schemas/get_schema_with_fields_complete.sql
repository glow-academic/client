-- Get schema with all fields
-- 1) Drop function first
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

-- 2) Create function
CREATE OR REPLACE FUNCTION api_get_schema_with_fields_v4(
    schema_id uuid
)
RETURNS TABLE (
    schema_id uuid,
    field_id uuid,
    field_name text,
    field_type text,
    required boolean,
    "position" integer,
    item_schema_id uuid
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        ar.id as schema_id,
        ar.id as field_id,
        ar.name as field_name,
        ar.field_type::text,
        ar.required,
        ar.position,
        NULL::uuid as item_schema_id
    FROM args_resource ar
    WHERE ar.id = $1
    ORDER BY ar.position, ar.name;
$$;
