-- Check rate limit and count runs today for a profile in a single query
-- Parameters: $1=profile_id (uuid), $2=start_of_day_utc (timestamp with time zone)
-- Returns: req_per_day (integer, nullable), runs_today_count (bigint), earliest_run_created_at (timestamp with time zone, nullable)
WITH profile_rate_limit AS (
    -- Get rate limit for the profile
    SELECT prl.requests_per_day as req_per_day
    FROM profiles p
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    WHERE p.id = $1::uuid
),
runs_today AS (
    -- Count model runs for this profile since start of day
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM model_runs mr
    JOIN model_run_profiles mrp ON mrp.model_run_id = mr.id
    WHERE mrp.profile_id = $1::uuid
      AND mrp.active = true
      AND mr.created_at >= $2::timestamp with time zone
)
SELECT 
    prl.req_per_day,
    COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
    rt.earliest_run_created_at
FROM profile_rate_limit prl
CROSS JOIN runs_today rt

