-- Get document by ID for test verification
-- Returns document details for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_document_by_id_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_document_by_id_v4(
    input_document_id uuid
)
RETURNS TABLE (
    document_id uuid,
    name text,
    description text,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        d.id AS document_id,
        (SELECT n.name FROM document_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1) AS name,
        (SELECT d2.description FROM document_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.document_id = d.id LIMIT 1) AS description,
        EXISTS (SELECT 1 FROM document_flags df JOIN flags_resource fl ON df.flag_id = fl.id WHERE df.document_id = d.id AND fl.name = 'active'  AND df.value = TRUE) AS active,
        d.created_at,
        d.updated_at
    FROM documents_resource d
    WHERE d.id = input_document_id;
$$;