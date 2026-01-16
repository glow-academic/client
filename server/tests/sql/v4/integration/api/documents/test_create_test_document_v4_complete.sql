-- Create a test document for test setup
-- Returns document data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_document_v4(text, text, boolean, text, text);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_document_v4(
    document_name text,
    document_description text DEFAULT 'Test document description',
    document_active boolean DEFAULT true
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
VOLATILE
AS $$
    WITH new_document AS (
        INSERT INTO documents_resource DEFAULT VALUES
        RETURNING id, created_at, updated_at
    ),
    name_resource AS (
        INSERT INTO names_resource(name)
        VALUES (document_name)
        RETURNING id
    ),
    description_resource AS (
        INSERT INTO descriptions_resource(description)
        VALUES (COALESCE(document_description, 'Test document description'))
        RETURNING id
    ),
    active_flag AS (
        SELECT id FROM flags_resource WHERE name = 'active' LIMIT 1
    ),
    document_name_link AS (
        INSERT INTO document_names(document_id, name_id)
        SELECT nd.id, nr.id
        FROM new_document nd, name_resource nr
        RETURNING document_id
    ),
    document_description_link AS (
        INSERT INTO document_descriptions(document_id, description_id)
        SELECT nd.id, dr.id
        FROM new_document nd, description_resource dr
        RETURNING document_id
    ),
    document_flag_link AS (
        INSERT INTO document_flags (document_id, flag_id, value)
        SELECT nd.id, af.id, COALESCE(document_active, true)
        FROM new_document nd, active_flag af
        RETURNING document_id
    )
    SELECT 
        nd.id AS document_id,
        (SELECT n.name FROM document_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = nd.id LIMIT 1) AS name,
        (SELECT d.description FROM document_descriptions dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = nd.id LIMIT 1) AS description,
        EXISTS (SELECT 1 FROM document_flags df JOIN flags_resource fl ON df.flag_id = fl.id WHERE df.document_id = nd.id AND fl.name = 'active'  AND df.value = TRUE) AS active,
        nd.created_at,
        nd.updated_at
    FROM new_document nd;
$$;