-- Get active auth provider slugs for login page
-- Returns slug field (used as kc_idp_hint in Keycloak authentication)
SELECT slug as id
FROM auth
WHERE active = true
ORDER BY slug;

