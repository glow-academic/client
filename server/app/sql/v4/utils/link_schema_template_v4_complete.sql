-- Link template to schema
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'utils_link_schema_template_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS utils_link_schema_template_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION utils_link_schema_template_v4(
    schema_id uuid,
    template_id uuid
)
RETURNS void
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO schema_templates (schema_id, template_id, created_at, updated_at)
    VALUES ($1, $2, NOW(), NOW())
    ON CONFLICT (schema_id, template_id) DO UPDATE SET updated_at = NOW()
$$;
