-- DEPRECATED: Create schema record
-- This function is deprecated - schemas_resource table has been dropped
-- Schemas are now just collections of args_resource entries (no separate schema table)
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'utils_create_schema_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS utils_create_schema_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function as no-op (deprecated)
-- Note: schemas_resource table has been dropped
-- Schemas are now just collections of args_resource entries linked via tool_args or document_args
CREATE OR REPLACE FUNCTION utils_create_schema_v4(
    schema_id uuid
)
RETURNS void
LANGUAGE sql
VOLATILE
AS $$
    -- DEPRECATED: This function no longer creates schemas
    -- schemas_resource table has been dropped
    -- Schemas are now just collections of args_resource entries
    SELECT NULL::void
$$;
