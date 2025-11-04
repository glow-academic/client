INSERT INTO profile_request_limits (profile_id, requests_per_day, active)
VALUES ($1, $2, true)
ON CONFLICT (profile_id, active) 
WHERE active = true
DO UPDATE SET 
    requests_per_day = EXCLUDED.requests_per_day,
    updated_at = NOW()

