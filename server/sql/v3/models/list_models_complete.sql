-- List all models with provider info and usage counts (flat structure)
-- Parameters: $1 = profile_id (uuid)
-- Returns: model_id, name, description, active, image_model, updated_at, 
--          provider (enum), base_url, can_edit, can_delete

WITH user_profile AS (
    SELECT role FROM profiles WHERE id = $1
),
-- Pre-aggregate persona usage counts for all models
persona_usage AS (
    SELECT 
        ptm.model_id,
        COUNT(*) as usage_count
    FROM personas p
    JOIN persona_text_model ptm ON ptm.persona_id = p.id AND ptm.active = true
    GROUP BY ptm.model_id
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
        m.image_model,
        m.updated_at,
        m.provider::text as provider,
        COALESCE(me.base_url, '') as base_url,
        COALESCE(pu.usage_count, 0) as persona_usage_count,
        COALESCE(au.usage_count, 0) as agent_usage_count
    FROM models m
    LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
    LEFT JOIN persona_usage pu ON pu.model_id = m.id
    LEFT JOIN agent_usage au ON au.model_id = m.id
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
        WHEN (mwu.persona_usage_count + mwu.agent_usage_count) = 0 THEN true
        ELSE false
    END as can_delete
FROM models_with_usage mwu
CROSS JOIN user_profile up
ORDER BY mwu.updated_at DESC

