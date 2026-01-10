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
        role,
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = (SELECT profile_id FROM params) AND pn.type = 'full'::type_profile_names LIMIT 1),
            (SELECT n1.name || ' ' || n2.name FROM profile_names pn1 JOIN names n1 ON pn1.name_id = n1.id JOIN profile_names pn2 ON pn2.profile_id = pn1.profile_id JOIN names n2 ON pn2.name_id = n2.id WHERE pn1.profile_id = (SELECT profile_id FROM params) AND pn1.type = 'first'::type_profile_names AND pn2.type = 'last'::type_profile_names LIMIT 1),
            'System'
        ) as actor_name
    FROM params x
    JOIN profile ON profile.id = x.profile_id
),
-- Pre-aggregate simulation usage counts for all models
-- Simulations are linked to models via simulation_text_domain_id/simulation_voice_domain_id -> domains -> agents -> model_id
simulation_usage AS (
    SELECT 
        am.model_id,
        COUNT(*) as usage_count
    FROM (
        SELECT adom_text.agent_id
        FROM simulation sim
        LEFT JOIN simulation_agent_domains sd_text ON sd_text.simulation_id = sim.id AND sd_text.type = 'text'::type_simulation_domains
        LEFT JOIN agent_domains adom_text ON adom_text.domain_id = sd_text.agent_domain_id
        WHERE sd_text.agent_domain_id IS NOT NULL
        UNION ALL
        SELECT adom_voice.agent_id
        FROM simulation sim
        LEFT JOIN simulation_agent_domains sd_voice ON sd_voice.simulation_id = sim.id AND sd_voice.type = 'voice'::type_simulation_domains
        LEFT JOIN agent_domains adom_voice ON adom_voice.domain_id = sd_voice.agent_domain_id
        WHERE sd_voice.agent_domain_id IS NOT NULL
    ) combined_agents
    JOIN agents a ON a.id = combined_agents.agent_id AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
    JOIN agent_models am ON am.agent_id = a.id
    GROUP BY am.model_id
),
-- Pre-aggregate agent usage counts for all models
agent_usage AS (
    SELECT 
        am.model_id,
        COUNT(*) as usage_count
    FROM agent a
    JOIN agent_models am ON am.agent_id = a.id
    GROUP BY am.model_id
),
-- Determine if model is an image model (has 'image' output modality)
image_model_check AS (
    SELECT 
        model_id,
        CASE WHEN COUNT(*) > 0 THEN true ELSE false END as image_model
    FROM model_modalities
    WHERE modality = 'image' AND is_input = false AND active = true
    GROUP BY model_id
),
models_with_usage AS (
    SELECT 
        m.id as model_id,
        (SELECT n.name FROM model_names mn JOIN names n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1),
        (SELECT d.description FROM model_descriptions md JOIN descriptions d ON md.description_id = d.id WHERE md.model_id = m.id LIMIT 1),
        EXISTS (SELECT 1 FROM model_flags mf JOIN flags fl ON mf.flag_id = fl.id WHERE mf.model_id = m.id AND fl.name = 'active' AND mf.type = 'active'::type_model_flags AND mf.value = TRUE) as active,
        COALESCE(imc.image_model, false) as image_model,
        m.updated_at,
        (SELECT dp.provider::text FROM model_domains md_j JOIN domains d ON d.id = md_j.domain_id JOIN domain_providers dp ON dp.domain_id = d.id WHERE md_j.model_id = m.id LIMIT 1) as provider,
        NULL::uuid as provider_id,  -- Provider is now enum, not UUID
        (SELECT dp.provider::text FROM model_domains md_j JOIN domains d ON d.id = md_j.domain_id JOIN domain_providers dp ON dp.domain_id = d.id WHERE md_j.model_id = m.id LIMIT 1) as provider_name,
        COALESCE((SELECT e.base_url FROM model_endpoints me_j JOIN endpoints e ON e.id = me_j.endpoint_id WHERE me_j.model_id = m.id AND e.active = true LIMIT 1), '') as base_url,
        COALESCE(su.usage_count, 0) as simulation_usage_count,
        COALESCE(au.usage_count, 0) as agent_usage_count
    FROM model m
    LEFT JOIN simulation_usage su ON su.model_id = m.id
    LEFT JOIN agent_usage au ON au.model_id = m.id
    LEFT JOIN image_model_check imc ON imc.model_id = m.id
),
provider_options_data AS (
    -- Get provider options from domain_providers (providers is now enum)
    SELECT DISTINCT
        dp.provider::text as value,
        dp.provider::text as label
    FROM domain_providers dp
    ORDER BY dp.provider::text
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