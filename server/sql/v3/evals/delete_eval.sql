-- Delete eval (cascades to junction table and grades via FK)
-- Parameters: $1=eval_id, $2=profile_id (uuid)
-- Returns: eval_id, eval_name, actor_name

WITH actor_profile AS (
    SELECT
        $2::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
eval_info AS (
    SELECT id::text as eval_id, name as eval_name FROM evals WHERE id = $1::uuid
),
delete_eval AS (
    DELETE FROM evals
    WHERE id = $1::uuid
    RETURNING id::text as eval_id
)
SELECT ei.eval_id, ei.eval_name, ap.actor_name
FROM eval_info ei
CROSS JOIN actor_profile ap
WHERE EXISTS (SELECT 1 FROM delete_eval)

