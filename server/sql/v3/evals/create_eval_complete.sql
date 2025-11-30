-- Create eval with runs junction table entries in a single transaction
-- Parameters: $1=name, $2=description, $3=rubric_id, $4=run_ids (uuid[]), $5=profile_id (uuid or "guest-profile-id")
-- Returns: eval_id

WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $5::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $5::text IS NULL OR $5::text = '' THEN NULL::uuid
            ELSE $5::uuid
        END as resolved_profile_id
),
new_eval AS (
    INSERT INTO evals (name, description, rubric_id, created_at, updated_at)
    VALUES ($1, $2, $3::uuid, NOW(), NOW())
    RETURNING id::text as eval_id
),
link_runs AS (
    -- Link runs if provided (array may be empty)
    INSERT INTO eval_runs (eval_id, run_id, completed, created_at, updated_at)
    SELECT 
        ne.eval_id::uuid,
        r_id::uuid,
        false,  -- Initially not completed
        NOW(),
        NOW()
    FROM new_eval ne
    CROSS JOIN UNNEST($4::uuid[]) as mr_id
    WHERE COALESCE(array_length($4::uuid[], 1), 0) > 0
    ON CONFLICT (eval_id, run_id) DO UPDATE SET
        completed = false,
        updated_at = NOW()
)
SELECT eval_id FROM new_eval

