-- List all models with provider info and usage counts
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

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
        COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM params x
    JOIN profiles ON profiles.id = x.profile_id
),
-- Pre-aggregate simulation usage counts for all models
-- Simulations are linked to models via simulation_text_agent_id/simulation_voice_agent_id -> agents -> model_id
simulation_usage AS (
    SELECT 
        a.model_id,
        COUNT(*) as usage_count
    FROM (
        SELECT sim.simulation_text_agent_id as agent_id
        FROM simulations sim
        WHERE sim.simulation_text_agent_id IS NOT NULL
        UNION ALL
        SELECT sim.simulation_voice_agent_id as agent_id
        FROM simulations sim
        WHERE sim.simulation_voice_agent_id IS NOT NULL
    ) combined_agents
    JOIN agents a ON a.id = combined_agents.agent_id AND a.active = true
    GROUP BY a.model_id
),
-- Pre-aggregate agent usage counts for all models
agent_usage AS (
    SELECT 
        model_id,
        COUNT(*) as usage_count
    FROM agents
    GROUP BY model_id
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
        m.name,
        m.description,
        m.active,
        COALESCE(imc.image_model, false) as image_model,
        m.updated_at,
        p.value as provider,
        p.id as provider_id,
        p.name as provider_name,
        COALESCE(me.base_url, '') as base_url,
        COALESCE(su.usage_count, 0) as simulation_usage_count,
        COALESCE(au.usage_count, 0) as agent_usage_count
    FROM models m
    JOIN providers p ON p.id = m.provider_id
    LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
    LEFT JOIN simulation_usage su ON su.model_id = m.id
    LEFT JOIN agent_usage au ON au.model_id = m.id
    LEFT JOIN image_model_check imc ON imc.model_id = m.id
),
provider_options_data AS (
    SELECT 
        value,
        name as label
    FROM providers
    WHERE active = true
    ORDER BY name
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

COMMIT;
