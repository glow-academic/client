-- Stop eval by marking all pending runs as completed
-- Parameters: $1=eval_id, $2=profile_id (uuid)
-- Returns: stopped_count, eval_name, actor_name

WITH actor_profile AS (
    SELECT
        $2::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
eval_info AS (
    SELECT name as eval_name FROM evals WHERE id = $1::uuid
),
stopped_runs AS (
    UPDATE eval_runs 
    SET completed = true, updated_at = NOW()
    WHERE eval_id = $1::uuid AND completed = false
    RETURNING run_id
)
SELECT 
    COUNT(*)::int as stopped_count,
    ei.eval_name,
    ap.actor_name
FROM stopped_runs sr
CROSS JOIN eval_info ei
CROSS JOIN actor_profile ap

