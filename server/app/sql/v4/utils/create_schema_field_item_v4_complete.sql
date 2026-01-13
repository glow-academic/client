-- Create schema field item link (for array types)
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

-- 2) Recreate function
CREATE OR REPLACE FUNCTION utils_create_schema_field_item_v4(
    schema_field_id uuid,
    item_schema_id uuid
)
RETURNS void
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO schema_field_items_resource (
        schema_field_id, item_schema_id, created_at, updated_at
    )
    VALUES ($1, $2, NOW(), NOW())
$$;
