-- Update provider with endpoint and API key in a single transaction
-- Parameters: $1=providerId, $2=name, $3=description, $4=api_key (encrypted, nullable), $5=base_url (nullable)
-- Returns: provider_id if updated, or no rows if provider doesn't exist
WITH provider_exists AS (
    -- Check if provider exists
    SELECT id, name
    FROM providers
    WHERE id = $1::uuid
),
update_provider AS (
    -- Update provider fields (name, description, and optionally api_key) if provider exists
    UPDATE providers SET
        name = $2,
        description = $3,
        api_key = COALESCE(NULLIF($4::text, ''), api_key),
        updated_at = NOW()
    WHERE id IN (SELECT id FROM provider_exists)
      AND ($4::text IS NULL OR $4::text != '')
    RETURNING id::text as provider_id
),
upsert_endpoint AS (
    -- Upsert provider endpoint if base_url provided and provider exists
    INSERT INTO provider_endpoints (provider_id, base_url)
    SELECT 
        pe.id,
        $5::text
    FROM provider_exists pe
    WHERE $5::text IS NOT NULL AND COALESCE(TRIM($5::text), '') != ''
    ON CONFLICT (provider_id)
    DO UPDATE SET
        base_url = EXCLUDED.base_url,
        updated_at = NOW()
)
SELECT provider_id FROM update_provider

