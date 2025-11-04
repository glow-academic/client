WITH user_profile AS (
    SELECT role FROM profiles WHERE id = $1
),
providers_data AS (
    SELECT 
        p.id as provider_id,
        p.name,
        p.description,
        CASE 
            WHEN up.role IN ('admin', 'superadmin') THEN true
            ELSE false
        END as can_edit
    FROM providers p
    CROSS JOIN user_profile up
),
-- Pre-aggregate persona usage counts for all models
persona_usage AS (
    SELECT 
        model_id,
        COUNT(*) as usage_count
    FROM personas
    GROUP BY model_id
),
-- Pre-aggregate agent usage counts for all models
agent_usage AS (
    SELECT 
        model_id,
        COUNT(*) as usage_count
    FROM agents
    GROUP BY model_id
),
models_with_usage AS (
    SELECT 
        m.provider_id,
        COALESCE(jsonb_agg(
            jsonb_build_object(
                'model_id', m.id::text,
                'name', m.name,
                'description', m.description,
                'active', m.active,
                'custom_model', m.custom_model,
                'image_model', m.image_model,
                'updated_at', m.updated_at,
                'persona_usage_count', COALESCE(pu.usage_count, 0),
                'agent_usage_count', COALESCE(au.usage_count, 0)
            ) ORDER BY m.updated_at DESC
        ), '[]'::jsonb) as models_json
    FROM models m
    LEFT JOIN persona_usage pu ON pu.model_id = m.id
    LEFT JOIN agent_usage au ON au.model_id = m.id
    WHERE m.provider_id IN (SELECT provider_id FROM providers_data)
    GROUP BY m.provider_id
)
SELECT 
    pd.provider_id,
    pd.name,
    pd.description,
    pd.can_edit,
    COALESCE(mwu.models_json, '[]'::jsonb) as models_json
FROM providers_data pd
LEFT JOIN models_with_usage mwu ON mwu.provider_id = pd.provider_id
ORDER BY pd.name

