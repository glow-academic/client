-- Update master realm SSL requirement to NONE for local development
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'infra_update_master_realm_ssl_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infra_update_master_realm_ssl_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION infra_update_master_realm_ssl_v4()
RETURNS TABLE (
    success boolean,
    message text
)
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
    UPDATE keycloak.realm 
    SET ssl_required = 'NONE' 
    WHERE name = 'master';
    
    RETURN QUERY SELECT 
        true as success,
        'Master realm SSL requirement set to NONE' as message;
END;
$$;
