-- Get template HTML by ID
-- Parameters: id (uuid)
-- Returns: html (text)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_template_html_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_template_html_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_template_html_v4(
    id uuid
)
RETURNS TABLE (
    html text
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(te.content, '') as html
FROM templates_resource t
LEFT JOIN texts_entry te ON te.id = t.texts_id AND te.active = true
WHERE t.id = api_get_template_html_v4.id;
$$;
