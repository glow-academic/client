-- DEPRECATED: Create schema field
-- This function is deprecated - schema_fields_resource table has been dropped
-- Use api_create_args_v4 instead to create args_resource entries
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'utils_create_schema_field_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS utils_create_schema_field_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function as no-op (deprecated)
-- Note: schema_fields_resource table has been dropped in favor of args_resource
-- This function is kept for backward compatibility but does nothing
CREATE OR REPLACE FUNCTION utils_create_schema_field_v4(
    field_id uuid,
    schema_id uuid,
    name text,
    field_type text,
    required boolean,
    position_value integer,
    description text DEFAULT NULL,
    placeholder text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
VOLATILE
AS $$
    -- DEPRECATED: This function no longer creates schema fields
    -- schema_fields_resource table has been dropped
    -- Use api_create_args_v4 instead to create args_resource entries
    SELECT NULL::void
$$;
