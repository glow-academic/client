-- Get HTML/text content for a template document
-- Returns the text content from the associated texts_resource → texts_entry chain
-- Uses template flag (via document_flags_junction) instead of dropped html column

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
    file_path text
)
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(ue.file_path, '') as file_path
    FROM documents_resource dr
    JOIN texts_resource tr ON tr.id = dr.text_id
    JOIN texts_texts_connection ttc ON ttc.texts_id = tr.id AND ttc.active = true
    JOIN texts_entry te ON te.id = ttc.text_id AND te.active = true
    LEFT JOIN uploads_entry ue ON ue.id = te.upload_id
    WHERE dr.id = p_id
      AND dr.text_id IS NOT NULL;
$$;
