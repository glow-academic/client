-- Duplicate model with profile_id for auditing
-- Name resource created by Python (passed as name_resource_id)
-- SQL links junctions, never creates resources (except models_resource which is artifact-specific)
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
    profile_id uuid,
    name_resource_id uuid DEFAULT NULL
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
    SELECT model_id AS model_id, profile_id AS profile_id, name_resource_id AS name_resource_id
),
model_exists_check AS (
    SELECT EXISTS(SELECT 1 FROM model_artifact WHERE id = (SELECT model_id FROM params))::boolean as model_exists
),
actor_profile AS (
    SELECT
        x.profile_id,
        COALESCE(COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.names_id = n.id WHERE pn.profile_id = p.id LIMIT 1), ''), 'System') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
source_model AS (
    SELECT
        (SELECT n.name FROM model_names_junction mn JOIN names_resource n ON mn.names_id = n.id WHERE mn.model_id = m.id LIMIT 1) as name,
        (SELECT d.description FROM model_descriptions_junction md JOIN descriptions_resource d ON md.descriptions_id = d.id WHERE md.model_id = m.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM model_flags_junction mf JOIN flags_resource f ON mf.flags_id = f.id WHERE mf.model_id = m.id AND f.name = 'model_active' AND f.value = TRUE) as active,
        NULL::uuid as domain_id,  -- Domain no longer exists, use NULL
        (SELECT mpj.providers_id FROM model_providers_junction mpj WHERE mpj.model_id = m.id AND mpj.active = true LIMIT 1) as provider_id
    FROM params x
    JOIN model_artifact m ON m.id = x.model_id
),
-- Get existing descriptions_id from junction and link (instead of creating new)
original_description_id AS (
    SELECT md.descriptions_id
    FROM model_descriptions_junction md
    WHERE md.model_id = (SELECT model_id FROM params)
    LIMIT 1
),
new_model_group AS (
    INSERT INTO groups_entry (id, created_at)
    SELECT uuidv7(), NOW()
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
-- Copy active value junction from source model (link to same existing value resource)
link_model_value AS (
    INSERT INTO model_values_junction (model_id, values_id, created_at, generated, mcp)
    SELECT
        dm.id,
        mv.values_id,
        NOW(),
        false,
        false
    FROM duplicated_model dm
    CROSS JOIN model_values_junction mv
    WHERE mv.model_id = (SELECT model_id FROM params) AND mv.active = true
    LIMIT 1
),
-- Create models resource entry for duplicated model artifact (artifact-specific)
duplicated_model_resource AS (
    INSERT INTO models_resource (active, generated, mcp, created_at)
    SELECT
        false,  -- Set to inactive (duplicate)
        false,
        false,
        NOW()
    FROM duplicated_model dm
    RETURNING id
),
-- Link duplicated model to models_resource via junction table
link_model_models_junction AS (
    INSERT INTO model_models_junction (model_id, models_id, active, created_at, generated, mcp)
    SELECT
        dm.id,
        dmr.id,
        true,
        NOW(),
        false,
        false
    FROM duplicated_model dm
    CROSS JOIN duplicated_model_resource dmr
    ON CONFLICT (model_id, models_id) DO NOTHING
),
-- Link model to name (created by Python, passed as name_resource_id)
link_model_name AS (
    INSERT INTO model_names_junction (model_id, names_id, created_at)
    SELECT
        dm.id,
        x.name_resource_id,
        NOW()
    FROM duplicated_model dm
    CROSS JOIN params x
    WHERE x.name_resource_id IS NOT NULL
    ON CONFLICT (model_id, names_id) DO NOTHING
),
-- Link model to existing description
link_model_description AS (
    INSERT INTO model_descriptions_junction (model_id, descriptions_id, created_at)
    SELECT
        dm.id,
        od.descriptions_id,
        NOW()
    FROM duplicated_model dm
    CROSS JOIN original_description_id od
    WHERE od.descriptions_id IS NOT NULL
    ON CONFLICT (model_id, descriptions_id) DO NOTHING
),
-- Link model to provider (via model_providers_junction)
link_model_provider AS (
    INSERT INTO model_providers_junction (model_id, providers_id, created_at)
    SELECT
        dm.id,  -- Use model_artifact.id from duplicated model
        sm.provider_id,
        NOW()
    FROM duplicated_model dm
    CROSS JOIN source_model sm
    WHERE sm.provider_id IS NOT NULL
    ON CONFLICT (model_id, providers_id) DO NOTHING
),
-- Link model active flag (set to false for duplicate)
link_model_active_flag AS (
    INSERT INTO model_flags_junction (model_id, flags_id, created_at) SELECT dm.id,
        f.id,
        NOW()
    FROM duplicated_model dm
    CROSS JOIN flags_resource f
    WHERE f.name = 'model_active'
    ON CONFLICT (model_id, flags_id) DO NOTHING
),
model_with_name AS (
    -- Get model with name for return
    SELECT
        dm.id,
        n.name
    FROM duplicated_model dm
    LEFT JOIN params x ON true
    LEFT JOIN names_resource n ON n.id = x.name_resource_id
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
