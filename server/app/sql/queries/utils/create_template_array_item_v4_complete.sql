-- DEPRECATED: Create template array item link
-- This function is deprecated - template_array_items_resource table has been dropped
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'utils_create_template_array_item_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS utils_create_template_array_item_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function as no-op (deprecated)
-- Note: template_array_items_resource table has been dropped
-- This function is kept for backward compatibility but does nothing
CREATE OR REPLACE FUNCTION utils_create_template_array_item_v4(
    template_id uuid,
    schema_field_id uuid,
    item_template_id uuid,
    position_value integer
)
RETURNS void
LANGUAGE sql
VOLATILE
AS $$
    -- DEPRECATED: This function no longer creates template array items
    -- template_array_items_resource table has been dropped
    SELECT NULL::void
$$;
