-- DEPRECATED: Create schema field item link (for array types)
-- This function is deprecated - schema_field_items_resource table has been dropped
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'utils_create_schema_field_item_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS utils_create_schema_field_item_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function as no-op (deprecated)
-- Note: schema_field_items_resource table has been dropped
-- This function is kept for backward compatibility but does nothing
CREATE OR REPLACE FUNCTION utils_create_schema_field_item_v4(
    schema_field_id uuid,
    item_schema_id uuid
)
RETURNS void
LANGUAGE sql
VOLATILE
AS $$
    -- DEPRECATED: This function no longer creates schema field items
    -- schema_field_items_resource table has been dropped
    SELECT NULL::void
$$;
