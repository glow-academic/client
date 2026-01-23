-- Duplicate document - fetches original and creates copy with resource links in single query
-- Converted to function
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_duplicate_document_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_duplicate_document_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_duplicate_document_v4(
    document_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    new_document_id uuid,
    original_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT document_id AS document_id,
           profile_id AS profile_id
),
user_profile AS (
    SELECT 
        COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
original_document AS (
    SELECT 
        d.id,
        (SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1),
        (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1)
    FROM params x
    JOIN document_artifact d ON d.id = x.document_id
),
original_departments AS (
    -- Get department IDs from original document
    SELECT department_id
    FROM params x
    JOIN document_departments_junction dd ON dd.document_id = x.document_id AND dd.active = true
),
original_fields AS (
    -- Get field IDs from original document
    SELECT field_id
    FROM params x
    JOIN document_fields_junction df ON df.document_id = x.document_id AND df.active = true
),
original_flags AS (
    -- Get flag IDs from original document
    SELECT flag_id
    FROM params x
    JOIN document_flags_junction df ON df.document_id = x.document_id
),
-- Insert name INTO names_resource table
new_name_resource AS (
    INSERT INTO names_resource (name, created_at)
    SELECT name || ' Copy', NOW()
    FROM original_document
    WHERE name IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as name_id, name
),
-- Insert description INTO descriptions_resource table
new_description_resource AS (
    INSERT INTO descriptions_resource (description, created_at)
    SELECT description, NOW()
    FROM original_document
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as description_id, description
),
new_document AS (
    INSERT INTO document_artifact (
        created_at,
        updated_at
    )
    SELECT 
        NOW(),
        NOW()
    FROM original_document od
    RETURNING id
),
-- Link document to name
link_document_name AS (
    INSERT INTO document_names_junction (document_id, name_id, created_at)
    SELECT 
        nd.id,
        nnr.name_id,
        NOW()
    FROM new_document nd
    CROSS JOIN new_name_resource nnr
    ON CONFLICT (document_id, name_id) DO NOTHING
),
-- Link document to description
link_document_description AS (
    INSERT INTO document_descriptions_junction (document_id, description_id, created_at)
    SELECT 
        nd.id,
        ndr.description_id,
        NOW()
    FROM new_document nd
    CROSS JOIN new_description_resource ndr
    ON CONFLICT (document_id, description_id) DO NOTHING
),
-- Link document active flag (set to false for duplicate)
link_document_active_flag AS (
    INSERT INTO document_flags_junction (document_id, flag_id, value, created_at) SELECT nd.id,
        f.id,
        FALSE,
        NOW()
    FROM new_document nd
    CROSS JOIN flags_resource f
    WHERE f.name = 'document_active'
    ON CONFLICT (document_id, flag_id) DO UPDATE SET 
        value = FALSE
),
-- Copy other flags from original document
copy_document_flags AS (
    INSERT INTO document_flags_junction (document_id, flag_id, value, created_at)
    SELECT 
        nd.id,
        of.flag_id,
        FALSE,
        NOW()
    FROM new_document nd
    CROSS JOIN original_flags of
    ON CONFLICT (document_id, flag_id) DO UPDATE SET 
        value = FALSE
),
copy_departments AS (
    -- Copy department links from original document
    INSERT INTO document_departments_junction (document_id, department_id, active, created_at)
    SELECT 
        nd.id,
        od.department_id,
        true,
        NOW()
    FROM new_document nd
    CROSS JOIN original_departments od
    RETURNING document_id
),
copy_fields AS (
    -- Copy field links from original document
    INSERT INTO document_fields_junction (document_id, field_id, active, created_at)
    SELECT 
        nd.id,
        of.field_id,
        true,
        NOW()
    FROM new_document nd
    CROSS JOIN original_fields of
    RETURNING document_id
)
SELECT 
    (SELECT id FROM new_document LIMIT 1) as new_document_id,
    (SELECT name FROM original_document LIMIT 1) as original_name,
    (SELECT actor_name FROM user_profile LIMIT 1) as actor_name
$$;
