-- UPDATE document_artifact with department links and field links in a single transaction
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
    department_id uuid DEFAULT NULL,
    field_ids text[] DEFAULT ARRAY[]::text[]
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
        department_id AS department_id,
        COALESCE(field_ids, ARRAY[]::text[]) AS field_ids
),
actor_profile AS (
    SELECT 
        p.id as profile_id,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
update_document AS (
    UPDATE document_artifact d
    SET 
        updated_at = NOW()
    FROM params p
    WHERE d.id = p.document_id
    RETURNING d.id
),
-- Domain-based agent assignment removed - no longer needed
update_document_agent_domain AS (
    -- Placeholder CTE (removed domain logic)
    SELECT NULL::uuid as dummy FROM params LIMIT 0
),
link_document_agent_domain AS (
    -- Placeholder CTE (removed domain logic)
    SELECT NULL::uuid as dummy FROM params LIMIT 0
),
-- Update name if provided
update_document_name AS (
    INSERT INTO names_resource (name, created_at, updated_at)
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
    INSERT INTO descriptions_resource (description, created_at, updated_at)
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
    SELECT id as flag_id FROM flags_resource WHERE name = 'active' LIMIT 1
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
    COALESCE((SELECT n.name FROM document_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = ud.id LIMIT 1), 'Unknown')::text as document_name,
    ap.actor_name::text as actor_name
FROM update_document ud
CROSS JOIN actor_profile ap
LIMIT 1
$$;