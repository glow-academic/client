-- Get template array items
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'utils_get_template_array_items_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS utils_get_template_array_items_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION utils_get_template_array_items_v4(
    template_id uuid
)
RETURNS TABLE (
    name text,
    item_template_id uuid,
    "position" integer
)
LANGUAGE sql
STABLE
AS $$
    SELECT sf.name, tai.item_template_id, tai."position"
    FROM template_array_items tai
    JOIN schema_fields sf ON sf.id = tai.schema_field_id
    WHERE tai.template_id = $1
    ORDER BY sf."position", tai."position"
$$;
