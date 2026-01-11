-- Get schema fields for a template_id
-- Returns schema field id, name, and field_type

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_schema_fields_by_template_id_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_schema_fields_by_template_id_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_schema_fields_by_template_id_v4(
    template_id uuid
)
RETURNS TABLE (
    id uuid,
    name text,
    field_type text
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        sf.id,
        sf.name::text as name,
        sf.field_type::text as field_type
    FROM schema_fields sf
    JOIN schemas s ON s.id = sf.schema_id
    JOIN schema_templates st ON st.schema_id = s.id
    WHERE st.template_id = template_id
    ORDER BY sf.position;
$$;
