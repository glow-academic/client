-- Get all active auth providers for Keycloak sync
-- Returns: id, slug, auth_type (as provider_id), name
SELECT 
    id, 
    slug, 
    auth_type as provider_id, 
    name 
FROM auth 
WHERE active = true
ORDER BY slug;

