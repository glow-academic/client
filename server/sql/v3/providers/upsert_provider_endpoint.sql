INSERT INTO provider_endpoints (provider_id, base_url)
VALUES ($1, $2)
ON CONFLICT (provider_id)
DO UPDATE SET
    base_url = EXCLUDED.base_url,
    updated_at = NOW()
RETURNING *

