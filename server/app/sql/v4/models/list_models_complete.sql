-- List all models with provider info and usage counts
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_list_models_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_list_models_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_list_models_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_list_models_v4_model AS (
    model_id uuid,
    name text,
    description text,
    active boolean,
    image_model boolean,
    updated_at timestamptz,
    provider text,
    provider_id uuid,
    provider_name text,
    base_url text,
    can_edit boolean,
    can_delete boolean
);

CREATE TYPE types.q_list_models_v4_provider_option AS (
    value text,
    label text
);

CREATE TYPE types.q_list_models_v4_status_option AS (
    value text,
    label text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_models_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    models types.q_list_models_v4_model[],
    provider_options types.q_list_models_v4_provider_option[],
    status_options types.q_list_models_v4_status_option[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_profile AS (
    SELECT 
        (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) as role,
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = (SELECT profile_id FROM params) AND pn.type = 'full'::type_profile_names LIMIT 1),
            (SELECT n1.name || ' ' || n2.name FROM profile_names pn1 JOIN names_resource n1 ON pn1.name_id = n1.id JOIN profile_names pn2 ON pn2.profile_id = pn1.profile_id JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn1.profile_id = (SELECT profile_id FROM params) AND pn1.type = 'first'::type_profile_names AND pn2.type = 'last'::type_profile_names LIMIT 1),
            'System'
        ) as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
    JOIN profile_artifact ON profile_artifact.id = x.profile_id
),
-- Pre-aggregate simulation usage counts for all models
-- Domain-based agent lookup removed - return empty result
simulation_usage AS (
    SELECT 
        am.model_id,
        COUNT(*) as usage_count
    FROM (
        SELECT NULL::uuid as agent_id WHERE false
    ) combined_agents
    JOIN agents_resource a ON a.id = combined_agents.agent_id AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' AND af.value = true)
    JOIN agent_models am ON am.agent_id = a.id
    GROUP BY am.model_id
),
-- Pre-aggregate agent usage counts for all models
agent_usage AS (
    SELECT 
        am.model_id,
        COUNT(*) as usage_count
    FROM agent_artifact a
    JOIN agent_models am ON am.agent_id = a.id
    GROUP BY am.model_id
),
-- Determine if model is an image model (has 'image' output modality)
image_model_check AS (
    SELECT 
        mm.model_id,
        CASE WHEN COUNT(*) > 0 THEN true ELSE false END as image_model
    FROM model_modalities mm
    JOIN modalities_resource mr ON mr.id = mm.modality_id
    WHERE mr.modality = 'image' AND mm.type = 'output'::type_model_modalities AND mm.active = true
    GROUP BY mm.model_id
),
models_with_usage AS (
    SELECT 
        m.id as model_id,
        (SELECT n.name FROM model_names mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1),
        (SELECT d.description FROM model_descriptions md JOIN descriptions_resource d ON md.description_id = d.id WHERE md.model_id = m.id LIMIT 1),
        EXISTS (SELECT 1 FROM model_flags mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = m.id AND f.name = 'active' AND mf.value = TRUE) as active,
        COALESCE(imc.image_model, false) as image_model,
        m.updated_at,
        (SELECT n.name FROM model_providers mp JOIN providers_resource p ON p.id = mp.providers_id JOIN provider_artifact pr ON pr.id = p.provider_id JOIN provider_names pn ON pn.provider_id = pr.id JOIN names_resource n ON n.id = pn.name_id JOIN models_resource m_res ON m_res.id = mp.model_id WHERE m_res.model_id = m.id LIMIT 1) as provider,
        (SELECT p.id FROM model_providers mp JOIN providers_resource p ON p.id = mp.providers_id JOIN models_resource m_res ON m_res.id = mp.model_id WHERE m_res.model_id = m.id LIMIT 1) as provider_id,
        (SELECT n.name FROM model_providers mp JOIN providers_resource p ON p.id = mp.providers_id JOIN provider_artifact pr ON pr.id = p.provider_id JOIN provider_names pn ON pn.provider_id = pr.id JOIN names_resource n ON n.id = pn.name_id JOIN models_resource m_res ON m_res.id = mp.model_id WHERE m_res.model_id = m.id LIMIT 1) as provider_name,
        COALESCE((SELECT e.base_url FROM model_endpoints me_j JOIN endpoints_resource e ON e.id = me_j.endpoint_id WHERE me_j.model_id = m.id AND e.active = true LIMIT 1), '') as base_url,
        COALESCE(su.usage_count, 0) as simulation_usage_count,
        COALESCE(au.usage_count, 0) as agent_usage_count
    FROM model_artifact m
    LEFT JOIN simulation_usage su ON su.model_id = m.id
    LEFT JOIN agent_usage au ON au.model_id = m.id
    LEFT JOIN image_model_check imc ON imc.model_id = m.id
),
provider_options_data AS (
    -- Get provider options FROM providers_resource resource table
    SELECT DISTINCT
        p.id::text as value,
        n.name as label
    FROM providers_resource p
    JOIN provider_artifact pr ON pr.id = p.provider_id
    JOIN provider_names pn ON pn.provider_id = pr.id
    JOIN names_resource n ON n.id = pn.name_id
    WHERE p.active = true
    ORDER BY n.name
),
models_aggregated AS (
    SELECT 
        up.actor_name,
        COALESCE(
            ARRAY_AGG(
                (mwu.model_id, mwu.name, mwu.description, mwu.active, mwu.image_model, mwu.updated_at,
                 mwu.provider, mwu.provider_id, mwu.provider_name, mwu.base_url,
                 CASE 
                     WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true
                     ELSE false
                 END,
                 CASE 
                     WHEN (mwu.simulation_usage_count + mwu.agent_usage_count) = 0 THEN true
                     ELSE false
                 END
                )::types.q_list_models_v4_model
                ORDER BY mwu.updated_at DESC
            ),
            '{}'::types.q_list_models_v4_model[]
        ) as models
    FROM models_with_usage mwu
    CROSS JOIN user_profile up
    GROUP BY up.actor_name
),
provider_options_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (value, label)::types.q_list_models_v4_provider_option
                ORDER BY label
            ),
            '{}'::types.q_list_models_v4_provider_option[]
        ) as provider_options
    FROM provider_options_data
)
SELECT 
    ma.actor_name::text as actor_name,
    ma.models,
    poa.provider_options,
    ARRAY[
        ('true', 'Active')::types.q_list_models_v4_status_option,
        ('false', 'Inactive')::types.q_list_models_v4_status_option
    ] as status_options
FROM models_aggregated ma
CROSS JOIN provider_options_aggregated poa
$$;