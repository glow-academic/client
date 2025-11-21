-- Get default model detail for creation (provider mapping only)
-- Parameters: none (returns all providers)
-- Returns: provider_mapping (jsonb) + valid_provider_ids (array)

WITH valid_providers AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                p.id::text,
                jsonb_build_object(
                    'name', p.name,
                    'description', COALESCE(p.description, '')
                )
            ),
            '{}'::jsonb
        ) as provider_mapping,
        array_agg(p.id::text ORDER BY p.name) as provider_ids
    FROM providers p
)
SELECT 
    vp.provider_mapping,
    vp.provider_ids as valid_provider_ids
FROM valid_providers vp

