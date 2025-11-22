SELECT 
    p.name,
    p.description,
    (SELECT k.key FROM models m
     JOIN model_keys mk ON mk.model_id = m.id AND mk.active = true
     JOIN keys k ON k.id = mk.key_id AND k.active = true AND k.type = 'api'
     WHERE m.provider_id = p.id
     LIMIT 1) as api_key,
    pe.base_url
FROM providers p
LEFT JOIN provider_endpoints pe ON pe.provider_id = p.id AND pe.active = true
WHERE p.id = $1

