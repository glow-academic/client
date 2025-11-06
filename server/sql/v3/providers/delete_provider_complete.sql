-- Delete provider with existence and usage checks in a single transaction
-- Parameters: $1=providerId
-- Returns: provider_id, name, and usage counts (or no rows if provider doesn't exist)
-- If any models are in use, provider is not deleted (caller should raise 400 error)
-- If no rows returned, provider doesn't exist (caller should raise 404 error)
WITH provider_info AS (
    -- Check if provider exists and get name
    SELECT 
        p.id,
        p.name,
        (SELECT COUNT(*) FROM models WHERE provider_id = p.id) as model_count
    FROM providers p
    WHERE p.id = $1::uuid
),
provider_models AS (
    -- Get all model IDs for this provider
    SELECT id
    FROM models
    WHERE provider_id IN (SELECT id FROM provider_info)
),
usage_check AS (
    -- Check if any models are in use by personas or agents
    SELECT 
        pi.id,
        pi.name,
        pi.model_count,
        (SELECT COUNT(*) FROM personas WHERE model_id IN (SELECT id FROM provider_models)) as persona_usage_count,
        (SELECT COUNT(*) FROM agents WHERE model_id IN (SELECT id FROM provider_models)) as agent_usage_count
    FROM provider_info pi
),
usage_summary AS (
    -- Calculate total usage
    SELECT 
        id,
        name,
        model_count,
        persona_usage_count,
        agent_usage_count,
        (persona_usage_count + agent_usage_count) as total_usage
    FROM usage_check
),
delete_provider AS (
    -- Delete provider only if it exists and no models are in use
    DELETE FROM providers
    WHERE id IN (
        SELECT id FROM usage_summary WHERE total_usage = 0
    )
    RETURNING id::text as provider_id
)
-- Return provider info and usage counts (even if not deleted, so caller can determine error)
SELECT 
    us.id::text as provider_id,
    us.name,
    us.model_count,
    us.persona_usage_count,
    us.agent_usage_count,
    us.total_usage,
    CASE WHEN dp.provider_id IS NOT NULL THEN true ELSE false END as deleted
FROM usage_summary us
LEFT JOIN delete_provider dp ON dp.provider_id = us.id::text

