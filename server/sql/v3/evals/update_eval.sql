-- Update eval with optional runs changes
-- Parameters: $1=eval_id, $2=name, $3=description, $4=rubric_id, $5=run_ids (uuid[] | NULL - if provided, replaces all)
-- Returns: eval_id

WITH update_eval AS (
    UPDATE evals SET
        name = $2,
        description = $3,
        rubric_id = $4::uuid,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as eval_id
),
-- If run_ids provided, replace all existing links
remove_existing_links AS (
    DELETE FROM eval_runs
    WHERE eval_id = $1::uuid
    AND $5::uuid[] IS NOT NULL
    AND COALESCE(array_length($5::uuid[], 1), 0) > 0
),
add_new_links AS (
    INSERT INTO eval_runs (eval_id, run_id, completed, created_at, updated_at)
    SELECT 
        $1::uuid,
        r_id::uuid,
        false,
        NOW(),
        NOW()
    FROM UNNEST($5::uuid[]) as mr_id
    WHERE $5::uuid[] IS NOT NULL
    AND COALESCE(array_length($5::uuid[], 1), 0) > 0
    ON CONFLICT (eval_id, run_id) DO UPDATE SET
        updated_at = NOW()
)
SELECT eval_id FROM update_eval

