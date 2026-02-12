-- Get HTML content for an HTML document
-- Returns the HTML text content from the associated texts_entry

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_document_html_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_document_html_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_document_html_v4(
    p_id uuid
)
RETURNS TABLE (
    html text
)
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(te.content, '') as html
    FROM documents_resource d
    LEFT JOIN texts_entry te ON te.id = d.text_id AND te.active = true
    WHERE d.id = p_id AND d.html = true;
$$;
