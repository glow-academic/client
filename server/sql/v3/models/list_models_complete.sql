-- List all models with provider info and usage counts (flat structure)
-- Parameters: $1 = profile_id (uuid)
-- Returns: model_id, name, description, active, custom_model, image_model, updated_at, 
--          provider_id, provider_name, provider_description, can_edit, can_delete,
--          provider_mapping (jsonb)

WITH user_profile AS (
    SELECT role FROM profiles WHERE id = $1
),
valid_providers AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                p.id::text,
                jsonb_build_object(
                    'name', p.name,
                    'description', COALESCE(p.description, '')
                )
            ),
            '{}'::jsonb
        ) as provider_mapping
    FROM providers p
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
        m.id as model_id,
        m.name,
        m.description,
        m.active,
        m.custom_model,
        m.image_model,
        m.updated_at,
        m.provider_id,
        p.name as provider_name,
        p.description as provider_description,
        COALESCE(pu.usage_count, 0) as persona_usage_count,
        COALESCE(au.usage_count, 0) as agent_usage_count
    FROM models m
    INNER JOIN providers p ON p.id = m.provider_id
    LEFT JOIN persona_usage pu ON pu.model_id = m.id
    LEFT JOIN agent_usage au ON au.model_id = m.id
)
SELECT 
    mwu.model_id::text,
    mwu.name,
    mwu.description,
    mwu.active,
    mwu.custom_model,
    mwu.image_model,
    mwu.updated_at,
    mwu.provider_id::text,
    mwu.provider_name,
    mwu.provider_description,
    CASE 
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_edit,
    CASE 
        WHEN (mwu.persona_usage_count + mwu.agent_usage_count) = 0 THEN true
        ELSE false
    END as can_delete,
    vp.provider_mapping
FROM models_with_usage mwu
CROSS JOIN user_profile up
CROSS JOIN valid_providers vp
ORDER BY mwu.updated_at DESC

