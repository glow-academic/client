SELECT 
    p.name,
    p.description,
    p.api_key,
    pe.base_url
FROM providers p
LEFT JOIN provider_endpoints pe ON pe.provider_id = p.id AND pe.active = true
WHERE p.id = $1

