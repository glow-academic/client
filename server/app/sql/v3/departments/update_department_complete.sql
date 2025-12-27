-- Update department with settings relationship in single query
-- Converted to function pattern
-- Uses safe drop/recreate pattern: drop function first, then recreate

BEGIN;

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_update_department_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_update_department_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_update_department_v3(
    department_id uuid,
    title text,
    description text,
    active boolean,
    settings_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    department_id uuid,
    title text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        department_id AS department_id,
        title AS title,
        description AS description,
        active AS active,
        settings_id AS settings_id,
        profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
department_update AS (
    -- Update department
    UPDATE departments SET
        title = (SELECT title FROM params),
        description = (SELECT description FROM params),
        active = (SELECT active FROM params),
        updated_at = NOW()
    WHERE id = (SELECT department_id FROM params)
    RETURNING id, title
),
remove_existing_settings AS (
    -- Remove existing settings link if settings_id is null or different
    DELETE FROM department_settings
    WHERE department_id = (SELECT department_id FROM params)
      AND (
          (SELECT settings_id FROM params) IS NULL 
          OR settings_id != (SELECT settings_id FROM params)
      )
),
link_settings AS (
    -- Link settings if provided
    INSERT INTO department_settings (settings_id, department_id, active, created_at, updated_at)
    SELECT 
        settings_id,
        du.id,
        true,
        NOW(),
        NOW()
    FROM department_update du
    CROSS JOIN params p
    WHERE p.settings_id IS NOT NULL
    ON CONFLICT (settings_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
-- Return updated department info
SELECT 
    du.id as department_id,
    du.title::text as title,
    ap.actor_name::text as actor_name
FROM department_update du
CROSS JOIN actor_profile ap
$$;

COMMIT;
