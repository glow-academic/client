-- Create template array item link
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

-- 2) Recreate function
CREATE OR REPLACE FUNCTION utils_create_template_array_item_v4(
    template_id uuid,
    schema_field_id uuid,
    item_template_id uuid,
    position integer
)
RETURNS void
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO template_array_items (
        template_id, schema_field_id, item_template_id, position,
        created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    ON CONFLICT (template_id, schema_field_id, item_template_id) DO NOTHING
$$;
