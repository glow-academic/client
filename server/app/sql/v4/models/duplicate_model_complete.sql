-- Duplicate model with profile_id for auditing
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_duplicate_model_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_duplicate_model_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_duplicate_model_v4(
    model_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    model_exists boolean,
    model_id uuid,
    original_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT model_id AS model_id, profile_id AS profile_id
),
model_exists_check AS (
    SELECT EXISTS(SELECT 1 FROM models WHERE id = (SELECT model_id FROM params))::boolean as model_exists
),
actor_profile AS (
    SELECT 
        x.profile_id,
        COALESCE(COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), ''), 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
source_model AS (
    SELECT 
        (SELECT n.name FROM model_names mn JOIN names n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1),
        (SELECT d.description FROM model_descriptions md JOIN descriptions d ON md.description_id = d.id WHERE md.model_id = m.id LIMIT 1),
        EXISTS (SELECT 1 FROM model_flags mf JOIN flags fl ON mf.flag_id = fl.id WHERE mf.model_id = m.id AND fl.name = 'active' AND mf.type = 'active'::type_model_flags AND mf.value = TRUE),
        (SELECT d.id FROM model_domains md_j JOIN domains d ON d.id = md_j.domain_id WHERE md_j.model_id = m.id LIMIT 1) as domain_id,
        (SELECT dp.provider FROM model_domains md_j JOIN domains d ON d.id = md_j.domain_id JOIN domain_providers dp ON dp.domain_id = d.id WHERE md_j.model_id = m.id LIMIT 1) as provider,
        m.value
    FROM params x
    JOIN models m ON m.id = x.model_id
),
-- Insert name into names table
new_name_resource AS (
    INSERT INTO names (name, created_at, updated_at)
    SELECT name || ' Copy', NOW(), NOW()
    FROM source_model
    WHERE name IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id, name
),
-- Insert description into descriptions table
new_description_resource AS (
    INSERT INTO descriptions (description, created_at, updated_at)
    SELECT description || ' Copy', NOW(), NOW()
    FROM source_model
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id, description
),
duplicated_model AS (
    INSERT INTO models (
        value
    )
    SELECT 
        sm.value
    FROM source_model sm
    CROSS JOIN model_exists_check mec
    WHERE mec.model_exists = true
    RETURNING id
),
-- Link model to name
link_model_name AS (
    INSERT INTO model_names (model_id, name_id, created_at, updated_at)
    SELECT 
        dm.id,
        nnr.name_id,
        NOW(),
        NOW()
    FROM duplicated_model dm
    CROSS JOIN new_name_resource nnr
    ON CONFLICT (model_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Link model to description
link_model_description AS (
    INSERT INTO model_descriptions (model_id, description_id, created_at, updated_at)
    SELECT 
        dm.id,
        ndr.description_id,
        NOW(),
        NOW()
    FROM duplicated_model dm
    CROSS JOIN new_description_resource ndr
    ON CONFLICT (model_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Link model to domain (which links to provider via domain_providers)
link_model_domain AS (
    INSERT INTO model_domains (model_id, domain_id, created_at, updated_at)
    SELECT 
        dm.id,
        sm.domain_id,
        NOW(),
        NOW()
    FROM duplicated_model dm
    CROSS JOIN source_model sm
    WHERE sm.domain_id IS NOT NULL
    ON CONFLICT (model_id, domain_id) DO UPDATE SET updated_at = NOW()
),
-- Link model active flag (set to false for duplicate)
link_model_active_flag AS (
    INSERT INTO model_flags (model_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        dm.id,
        f.id,
        'active'::type_model_flags,
        FALSE,
        NOW(),
        NOW()
    FROM duplicated_model dm
    CROSS JOIN flags f
    WHERE f.name = 'active'
    ON CONFLICT (model_id, flag_id, type) DO UPDATE SET 
        value = FALSE,
        updated_at = NOW()
),
model_with_name AS (
    -- Get model with name for return
    SELECT 
        dm.id,
        nnr.name
    FROM duplicated_model dm
    LEFT JOIN new_name_resource nnr ON true
)
SELECT 
    mec.model_exists::boolean as model_exists,
    mwn.id as model_id,
    sm.name::text as original_name,
    ap.actor_name::text as actor_name
FROM model_exists_check mec
CROSS JOIN source_model sm
CROSS JOIN model_with_name mwn
CROSS JOIN actor_profile ap
WHERE mec.model_exists = true
LIMIT 1
$$;