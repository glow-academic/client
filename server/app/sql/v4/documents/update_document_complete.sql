-- Update document with department links and field links in a single transaction
-- Converted to function pattern
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_update_document_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_update_document_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_update_document_v4(
    document_id uuid,
    profile_id uuid,
    name text DEFAULT NULL,
    description text DEFAULT NULL,
    active boolean DEFAULT NULL,
    template boolean DEFAULT NULL,
    department_id uuid DEFAULT NULL,
    field_ids text[] DEFAULT ARRAY[]::text[],
    document_domain_id uuid DEFAULT NULL,
    html_id uuid DEFAULT NULL,
    schema_id uuid DEFAULT NULL
)
RETURNS TABLE (
    success boolean,
    message text,
    document_id uuid,
    document_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        document_id AS document_id,
        profile_id AS profile_id,
        name AS name,
        description AS description,
        active AS active,
        template AS template,
        department_id AS department_id,
        COALESCE(field_ids, ARRAY[]::text[]) AS field_ids,
        document_domain_id AS document_domain_id,
        html_id AS html_id,
        schema_id AS schema_id
),
actor_profile AS (
    SELECT 
        p.id as profile_id,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
update_document AS (
    UPDATE documents d
    SET 
        document_domain_id = COALESCE((SELECT document_domain_id FROM params), d.document_domain_id),
        updated_at = NOW()
    FROM params p
    WHERE d.id = p.document_id
    RETURNING d.id
),
-- Update name if provided
update_document_name AS (
    INSERT INTO names (name, created_at, updated_at)
    SELECT (SELECT name FROM params), NOW(), NOW()
    WHERE (SELECT name FROM params) IS NOT NULL AND (SELECT name FROM params) != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id, name
),
link_document_name AS (
    INSERT INTO document_names (document_id, name_id, created_at, updated_at)
    SELECT 
        ud.id,
        udn.name_id,
        NOW(),
        NOW()
    FROM update_document ud
    CROSS JOIN update_document_name udn
    WHERE (SELECT name FROM params) IS NOT NULL
    ON CONFLICT (document_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Update description if provided
update_document_description AS (
    INSERT INTO descriptions (description, created_at, updated_at)
    SELECT (SELECT description FROM params), NOW(), NOW()
    WHERE (SELECT description FROM params) IS NOT NULL AND (SELECT description FROM params) != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id, description
),
link_document_description AS (
    INSERT INTO document_descriptions (document_id, description_id, created_at, updated_at)
    SELECT 
        ud.id,
        udd.description_id,
        NOW(),
        NOW()
    FROM update_document ud
    CROSS JOIN update_document_description udd
    WHERE (SELECT description FROM params) IS NOT NULL
    ON CONFLICT (document_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Get active flag ID
active_flag_id AS (
    SELECT id as flag_id FROM flags WHERE name = 'active' LIMIT 1
),
-- Update active flag if provided
update_document_active_flag AS (
    INSERT INTO document_flags (document_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        ud.id,
        afi.flag_id,
        'active'::type_document_flags,
        (SELECT active FROM params),
        NOW(),
        NOW()
    FROM update_document ud
    CROSS JOIN active_flag_id afi
    WHERE (SELECT active FROM params) IS NOT NULL
    ON CONFLICT (document_id, flag_id, type) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW()
),
-- Get template flag ID
template_flag_id AS (
    SELECT id as flag_id FROM flags WHERE name = 'template' LIMIT 1
),
-- Update template flag if provided
update_document_template_flag AS (
    INSERT INTO document_flags (document_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        ud.id,
        tfi.flag_id,
        'template'::type_document_flags,
        (SELECT template FROM params),
        NOW(),
        NOW()
    FROM update_document ud
    CROSS JOIN template_flag_id tfi
    WHERE (SELECT template FROM params) IS NOT NULL
    ON CONFLICT (document_id, flag_id, type) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW()
),
create_template AS (
    -- Create template (just values, no schema/HTML refs) if html_id and schema_id are provided
    INSERT INTO templates (name, created_at, updated_at)
    SELECT 
        COALESCE((SELECT n.name FROM document_names dn JOIN names n ON dn.name_id = n.id WHERE dn.document_id = (SELECT document_id FROM params) LIMIT 1), 'Template'),
        NOW(),
        NOW()
    FROM params p
    WHERE p.html_id IS NOT NULL AND p.schema_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM document_templates dt
          JOIN document_html dh ON dh.document_id = dt.document_id AND dh.html_id = p.html_id AND dh.active = true
          JOIN document_schemas ds ON ds.document_id = dt.document_id AND ds.schema_id = p.schema_id AND ds.active = true
          WHERE dt.active = true
      )
    RETURNING id as template_id
),
get_existing_template AS (
    -- Get existing template if it exists (matching html_id and schema_id via document_html and document_schemas)
    SELECT DISTINCT dt.template_id
    FROM params p
    JOIN document_templates dt ON dt.active = true
    JOIN document_html dh ON dh.document_id = dt.document_id AND dh.html_id = p.html_id AND dh.active = true
    JOIN document_schemas ds ON ds.document_id = dt.document_id AND ds.schema_id = p.schema_id AND ds.active = true
    WHERE p.html_id IS NOT NULL AND p.schema_id IS NOT NULL
    LIMIT 1
),
template_id AS (
    SELECT template_id FROM create_template
    UNION ALL
    SELECT template_id FROM get_existing_template
    WHERE EXISTS (SELECT 1 FROM params WHERE html_id IS NOT NULL AND schema_id IS NOT NULL)
    LIMIT 1
),
link_template_schema AS (
    -- Link template to schema via schema_templates junction table
    INSERT INTO schema_templates (schema_id, template_id, created_at, updated_at)
    SELECT 
        p.schema_id,
        ti.template_id,
        NOW(),
        NOW()
    FROM template_id ti
    CROSS JOIN params p
    WHERE p.schema_id IS NOT NULL
    ON CONFLICT (schema_id, template_id) DO UPDATE SET
        updated_at = NOW()
),
deactivate_previous_templates AS (
    -- Deactivate all previous templates if new one is provided
    UPDATE document_templates
    SET active = false, updated_at = NOW()
    WHERE document_id = (SELECT document_id FROM params)
      AND active = true
      AND (SELECT html_id FROM params) IS NOT NULL
),
update_template_link AS (
    -- Update or insert template link (without html_id and schema_id)
    INSERT INTO document_templates (document_id, template_id, active, created_at, updated_at)
    SELECT 
        p.document_id,
        ti.template_id,
        true,
        NOW(),
        NOW()
    FROM template_id ti
    CROSS JOIN params p
    WHERE p.html_id IS NOT NULL AND p.schema_id IS NOT NULL
    ON CONFLICT (document_id, template_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
update_html_link AS (
    -- Update or insert HTML link via document_html junction
    INSERT INTO document_html (document_id, html_id, active, created_at, updated_at)
    SELECT 
        p.document_id,
        p.html_id,
        true,
        NOW(),
        NOW()
    FROM params p
    WHERE p.html_id IS NOT NULL
    ON CONFLICT (document_id, html_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
update_schema_link AS (
    -- Update or insert schema link via document_schemas junction
    INSERT INTO document_schemas (document_id, schema_id, active, created_at, updated_at)
    SELECT 
        p.document_id,
        p.schema_id,
        true,
        NOW(),
        NOW()
    FROM params p
    WHERE p.schema_id IS NOT NULL
    ON CONFLICT (document_id, schema_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
delete_html_link AS (
    -- Deactivate HTML link if html_id is NULL (removing template)
    UPDATE document_html 
    SET active = false, updated_at = NOW()
    WHERE document_id = (SELECT document_id FROM params)
    AND (SELECT html_id FROM params) IS NULL
),
delete_schema_link AS (
    -- Deactivate schema link if schema_id is NULL (removing template)
    UPDATE document_schemas 
    SET active = false, updated_at = NOW()
    WHERE document_id = (SELECT document_id FROM params)
    AND (SELECT schema_id FROM params) IS NULL
),
delete_template_link AS (
    -- Delete template link if html_id is NULL (removing template)
    DELETE FROM document_templates 
    WHERE document_id = (SELECT document_id FROM params)
    AND (SELECT html_id FROM params) IS NULL
),
replace_departments AS (
    -- Delete all existing department links
    DELETE FROM document_departments 
    WHERE document_id = (SELECT document_id FROM params)
),
link_department AS (
    -- Insert new department link if provided
    INSERT INTO document_departments (document_id, department_id, active, created_at, updated_at)
    SELECT p.document_id, p.department_id, true, NOW(), NOW()
    FROM params p
    WHERE p.department_id IS NOT NULL
    ON CONFLICT (document_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_fields AS (
    -- Delete all existing field links
    DELETE FROM document_fields 
    WHERE document_id = (SELECT document_id FROM params)
),
link_fields AS (
    -- Insert new field links if provided (array is never NULL, but may be empty)
    INSERT INTO document_fields (document_id, field_id, active, created_at, updated_at)
    SELECT 
        p.document_id,
        field_id::uuid,
        true,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN unnest(p.field_ids) as field_id
    WHERE COALESCE(array_length(p.field_ids, 1), 0) > 0
    ON CONFLICT (document_id, field_id) DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
)
SELECT 
    true::boolean as success,
    'Document updated successfully'::text as message,
    ud.id as document_id,
    COALESCE((SELECT n.name FROM document_names dn JOIN names n ON dn.name_id = n.id WHERE dn.document_id = ud.id LIMIT 1), 'Unknown')::text as document_name,
    ap.actor_name::text as actor_name
FROM update_document ud
CROSS JOIN actor_profile ap
LIMIT 1
$$;