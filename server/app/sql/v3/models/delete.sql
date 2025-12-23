-- Delete model with usage checks (personas and agents) and name fetch - returns usage counts, name, and deleted (boolean)
-- Parameters: $1 = model_id (uuid), $2 = profile_id (uuid)
-- Returns: personas_usage_count (int), agents_usage_count (int), name (text), deleted (boolean), actor_name (text)

WITH actor_profile AS (
    SELECT 
        $2::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
personas_usage_check AS (
    -- Personas are no longer directly linked to models (persona_text_model dropped in migration 44)
    -- So there's no direct usage check needed for personas
    SELECT 0 as usage_count
),
agents_usage_check AS (
    SELECT COUNT(*) as usage_count
    FROM agents
    WHERE model_id = $1::uuid
),
model_info AS (
    SELECT name FROM models WHERE id = $1::uuid
),
delete_result AS (
    DELETE FROM models 
    WHERE id = $1::uuid 
      AND (SELECT usage_count FROM personas_usage_check) = 0
      AND (SELECT usage_count FROM agents_usage_check) = 0
      AND EXISTS(SELECT 1 FROM model_info)
    RETURNING id
)
SELECT 
    (SELECT usage_count FROM personas_usage_check) as personas_usage_count,
    (SELECT usage_count FROM agents_usage_check) as agents_usage_count,
    (SELECT name FROM model_info) as name,
    CASE WHEN EXISTS(SELECT 1 FROM delete_result) THEN true ELSE false END as deleted,
    (SELECT actor_name FROM actor_profile) as actor_name

