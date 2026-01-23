-- Record profile login entry (INSERT only, never modifies profile data)
-- For use by auth flows - tracks login history without touching profile
-- Uses safe drop/recreate pattern: drop function first, then recreate
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_record_profile_login_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_record_profile_login_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_record_profile_login_v4(
    profile_id uuid
)
RETURNS TABLE (
    login_id uuid,
    profile_id uuid,
    last_login timestamptz,
    ok boolean
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id
),
-- Verify profile exists
profile_exists AS (
    SELECT id
    FROM profile_artifact
    WHERE id = (SELECT profile_id FROM params)
    LIMIT 1
),
placeholder_call_id AS (
    SELECT id FROM calls_entry LIMIT 1
),
-- Insert login entry
login_insert AS (
    INSERT INTO logins_entry (last_login, call_id, created_at, updated_at)
    SELECT
        NOW(),
        (SELECT id FROM placeholder_call_id),
        NOW(),
        NOW()
    WHERE EXISTS (SELECT 1 FROM profile_exists)
    RETURNING id, last_login
),
-- Link login to profile via junction table
login_profile_link AS (
    INSERT INTO profile_logins_junction (profile_id, login_id)
    SELECT (SELECT profile_id FROM params), li.id
    FROM login_insert li
)
SELECT
    li.id as login_id,
    (SELECT profile_id FROM params) as profile_id,
    li.last_login,
    true as ok
FROM login_insert li
UNION ALL
SELECT
    NULL::uuid as login_id,
    (SELECT profile_id FROM params) as profile_id,
    NULL::timestamptz as last_login,
    false as ok
WHERE NOT EXISTS (SELECT 1 FROM login_insert)
LIMIT 1
$$;
