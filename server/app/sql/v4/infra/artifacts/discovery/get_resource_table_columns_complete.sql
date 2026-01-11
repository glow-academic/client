-- Get table columns for a resource type
-- Queries information_schema.columns to get all columns for the resource table
-- Filters out system columns (id, created_at, updated_at)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_resource_table_columns_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_resource_table_columns_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_resource_table_columns_v4(
    resource_type text
)
RETURNS TABLE (
    name text,
    data_type text,
    is_nullable boolean,
    column_default text
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        column_name::text as name,
        data_type::text as data_type,
        (is_nullable = 'YES') as is_nullable,
        column_default::text as column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = resource_type
      AND column_name NOT IN ('id', 'created_at', 'updated_at')
    ORDER BY ordinal_position;
$$;
