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
    SELECT EXISTS(SELECT 1 FROM model_artifact WHERE id = (SELECT model_id FROM params))::boolean as model_exists
),
actor_profile AS (
    SELECT 
        x.profile_id,
        COALESCE(COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), ''), 'System') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
source_model AS (
    SELECT 
        (SELECT n.name FROM model_names_junction mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1) as name,
        (SELECT d.description FROM model_descriptions_junction md JOIN descriptions_resource d ON md.description_id = d.id WHERE md.model_id = m.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = m.id AND f.name = 'model_active' AND mf.value = TRUE) as active,
        NULL::uuid as domain_id,  -- Domain no longer exists, use NULL
        (SELECT p_prov.id FROM model_providers_junction mp JOIN providers_resource p_prov ON p_prov.id = mp.providers_id WHERE mp.model_id = m.id LIMIT 1) as providers_id,
        (SELECT v.value FROM model_values_junction mv JOIN values_resource v ON mv.value_id = v.id WHERE mv.model_id = m.id LIMIT 1) as value
    FROM params x
    JOIN models_resource m ON m.id = x.model_id
),
-- Insert name INTO names_resource table
new_name_resource AS (
    INSERT INTO names_resource (name, created_at)
    SELECT name || ' Copy', NOW()
    FROM source_model
    WHERE name IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as name_id, name
),
-- Insert description INTO descriptions_resource table
new_description_resource AS (
    INSERT INTO descriptions_resource (description, created_at)
    SELECT description || ' Copy', NOW()
    FROM source_model
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as description_id, description
),
new_model_group AS (
    INSERT INTO groups_entry (id, created_at, updated_at)
    SELECT uuidv7(), NOW(), NOW()
    FROM source_model sm
    CROSS JOIN model_exists_check mec
    WHERE mec.model_exists = true
    RETURNING id
),
duplicated_model AS (
    INSERT INTO model_artifact (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM source_model sm
    CROSS JOIN model_exists_check mec
    WHERE mec.model_exists = true
    RETURNING id
),
link_model_group AS (
    INSERT INTO model_groups_junction (model_id, group_id)
    SELECT dm.id, nmg.id
    FROM duplicated_model dm
    CROSS JOIN new_model_group nmg
    ON CONFLICT (model_id, group_id) DO NOTHING
),
-- Insert value for duplicated model
duplicated_model_value AS (
    INSERT INTO values_resource (value, created_at, active, generated, mcp, call_id)
    SELECT 
        sm.value,
        NOW(),
        true,
        false,
        false,
        NULL
    FROM source_model sm
    CROSS JOIN duplicated_model dm
    WHERE sm.value IS NOT NULL AND sm.value != ''
    ON CONFLICT (value) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as value_id
),
link_duplicated_model_value AS (
    INSERT INTO model_values_junction (model_id, value_id, created_at, generated, mcp)
    SELECT 
        dm.id,
        dmv.value_id,
        NOW(),
        false,
        false
    FROM duplicated_model dm
    CROSS JOIN duplicated_model_value dmv
    RETURNING model_id
),
-- Create models resource entry for duplicated model artifact
duplicated_model_resource AS (
    INSERT INTO models_resource (model_id, active, generated, mcp, created_at)
    SELECT 
        dm.id,
        false,  -- Set to inactive (duplicate)
        false,
        false,
        NOW()
    FROM duplicated_model dm
    RETURNING id, model_id
),
-- Link model to name
link_model_name AS (
    INSERT INTO model_names_junction (model_id, name_id, created_at)
    SELECT 
        dm.id,
        nnr.name_id,
        NOW()
    FROM duplicated_model dm
    CROSS JOIN new_name_resource nnr
    ON CONFLICT (model_id, name_id) DO NOTHING
),
-- Link model to description
link_model_description AS (
    INSERT INTO model_descriptions_junction (model_id, description_id, created_at)
    SELECT 
        dm.id,
        ndr.description_id,
        NOW()
    FROM duplicated_model dm
    CROSS JOIN new_description_resource ndr
    ON CONFLICT (model_id, description_id) DO NOTHING
),
-- Link model to provider (via model_providers_junction)
link_model_provider AS (
    INSERT INTO model_providers_junction (model_id, providers_id, created_at)
    SELECT 
        dmr.id,  -- Use models.id (resource) from duplicated model resource
        sm.providers_id,
        NOW()
    FROM duplicated_model_resource dmr
    CROSS JOIN source_model sm
    WHERE sm.providers_id IS NOT NULL
    ON CONFLICT (model_id, providers_id) DO NOTHING
),
-- Link model active flag (set to false for duplicate)
link_model_active_flag AS (
    INSERT INTO model_flags_junction (model_id, flag_id, value, created_at) SELECT dm.id,
        f.id,
        FALSE,
        NOW()
    FROM duplicated_model dm
    CROSS JOIN flags_resource f
    WHERE f.name = 'model_active'
    ON CONFLICT (model_id, flag_id) DO UPDATE SET 
        value = FALSE
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