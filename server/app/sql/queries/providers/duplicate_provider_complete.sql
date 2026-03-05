-- Duplicate provider - creates copy linking to existing resources (except name)
-- Only name gets " Copy" suffix, active flag set to FALSE
-- All other resources (description, value, departments) link to existing
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
        WHERE proname = 'api_duplicate_provider_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_duplicate_provider_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_duplicate_provider_v4(
    provider_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    new_provider_id uuid,
    original_name text
)
LANGUAGE sql
VOLATILE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT provider_id AS provider_id,
           profile_id AS profile_id
),
original_provider AS (
    SELECT
        pr.id,
        (SELECT n.name FROM provider_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.provider_id = pr.id LIMIT 1) as name,
        (SELECT pd.description_id FROM provider_descriptions_junction pd WHERE pd.provider_id = pr.id LIMIT 1) as description_id,
        (SELECT pv.values_id FROM provider_values_junction pv WHERE pv.provider_id = pr.id AND pv.active = true LIMIT 1) as value_id
    FROM params x
    JOIN provider_artifact pr ON pr.id = x.provider_id
),
original_departments AS (
    -- Get department IDs from original provider
    SELECT department_id
    FROM params x
    JOIN provider_departments_junction pd ON pd.provider_id = x.provider_id AND pd.active = true
),
-- Insert name INTO names_resource table (only resource that gets copied with " Copy" suffix)
new_name_resource AS (
    INSERT INTO names_resource (name, created_at)
    SELECT name || ' Copy', NOW()
    FROM original_provider
    WHERE name IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as name_id, name
),
new_provider AS (
    INSERT INTO provider_artifact (
        created_at,
        updated_at
    )
    SELECT
        NOW(),
        NOW()
    FROM original_provider op
    RETURNING id
),
-- Link provider to name (new name with " Copy" suffix)
link_provider_name AS (
    INSERT INTO provider_names_junction (provider_id, name_id, created_at)
    SELECT
        np.id,
        nnr.name_id,
        NOW()
    FROM new_provider np
    CROSS JOIN new_name_resource nnr
    ON CONFLICT (provider_id, name_id) DO NOTHING
),
-- Link provider to existing description
link_provider_description AS (
    INSERT INTO provider_descriptions_junction (provider_id, description_id, created_at)
    SELECT
        np.id,
        op.description_id,
        NOW()
    FROM new_provider np
    CROSS JOIN original_provider op
    WHERE op.description_id IS NOT NULL
    ON CONFLICT (provider_id, description_id) DO NOTHING
),
-- Link provider active flag (set to false for duplicate)
link_provider_active_flag AS (
    INSERT INTO provider_flags_junction (provider_id, flag_id, created_at)
    SELECT np.id,
        f.id,
        NOW()
    FROM new_provider np
    CROSS JOIN flags_resource f
    WHERE f.name = 'provider_active'
    ON CONFLICT (provider_id, flag_id) DO NOTHING
),
-- Link provider to existing value
link_provider_value AS (
    INSERT INTO provider_values_junction (provider_id, values_id, created_at)
    SELECT
        np.id,
        op.value_id,
        NOW()
    FROM new_provider np
    CROSS JOIN original_provider op
    WHERE op.value_id IS NOT NULL
    ON CONFLICT ON CONSTRAINT provider_values_pkey DO NOTHING
),
-- Link provider to existing departments
copy_departments AS (
    INSERT INTO provider_departments_junction (provider_id, department_id, active, created_at)
    SELECT
        np.id,
        od.department_id,
        true,
        NOW()
    FROM new_provider np
    CROSS JOIN original_departments od
    ON CONFLICT ON CONSTRAINT provider_departments_pkey DO NOTHING
),
-- Copy providers_resource link (the openai/gemini enum)
link_providers_resource AS (
    INSERT INTO provider_providers_junction (provider_id, providers_id)
    SELECT
        np.id,
        ppj.providers_id
    FROM new_provider np
    CROSS JOIN params x
    JOIN provider_providers_junction ppj ON ppj.provider_id = x.provider_id
    ON CONFLICT DO NOTHING
)
SELECT
    (SELECT id FROM new_provider LIMIT 1) as new_provider_id,
    (SELECT name FROM original_provider LIMIT 1) as original_name
$$;

