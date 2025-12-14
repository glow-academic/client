-- List all models with provider info and usage counts (flat structure)
-- Parameters: $1 = profile_id (uuid)
-- Returns: model_id, name, description, active, image_model, updated_at, 
--          provider (enum), base_url, can_edit, can_delete

WITH user_profile AS (
    SELECT role FROM profiles WHERE id = $1
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
        p.id::text as provider_id,
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
)
SELECT 
    mwu.model_id::text,
    mwu.name,
    mwu.description,
    mwu.active,
    mwu.image_model,
    mwu.updated_at,
    mwu.provider,
    mwu.base_url,
    CASE 
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_edit,
    CASE 
        WHEN (mwu.simulation_usage_count + mwu.agent_usage_count) = 0 THEN true
        ELSE false
    END as can_delete
FROM models_with_usage mwu
CROSS JOIN user_profile up
ORDER BY mwu.updated_at DESC

