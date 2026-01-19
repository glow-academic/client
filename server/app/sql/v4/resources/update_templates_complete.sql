-- Update templates resource (HTML, name, description)
-- Parameters: template_id (uuid), html (text), name (text, optional), description (text, optional)
-- Returns: template_id (uuid)

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_update_templates_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_update_templates_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_update_templates_v4(
    template_id uuid,
    html text,
    name text DEFAULT NULL,
    description text DEFAULT NULL
)
RETURNS TABLE (
    template_id uuid
)
LANGUAGE sql
AS $$
WITH template_exists AS (
    SELECT id
    FROM templates_resource
    WHERE id = api_update_templates_v4.template_id
      AND active = true
),
update_template AS (
    UPDATE templates_resource
    SET html = COALESCE(api_update_templates_v4.html, templates_resource.html),
        name = COALESCE(api_update_templates_v4.name, templates_resource.name),
        description = COALESCE(api_update_templates_v4.description, templates_resource.description),
        updated_at = NOW()
    WHERE id IN (SELECT id FROM template_exists)
    RETURNING id as template_id
)
SELECT template_id FROM update_template
$$;
