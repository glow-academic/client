-- Duplicate department - fetches original and creates copy in single query
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
        WHERE proname = 'api_duplicate_department_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_duplicate_department_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_duplicate_department_v3(
    department_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    new_department_id uuid,
    original_title text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        department_id AS department_id,
        profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
original_dept AS (
    SELECT 
        id,
        title,
        description,
        active
    FROM departments
    WHERE id = (SELECT department_id FROM params)
),
new_dept AS (
    INSERT INTO departments (title, description, active, created_at, updated_at)
    SELECT 
        title || ' Copy',
        description,
        false,
        NOW(),
        NOW()
    FROM original_dept
    RETURNING id
)
SELECT 
    nd.id as new_department_id,
    od.title::text as original_title,
    ap.actor_name::text as actor_name
FROM new_dept nd
CROSS JOIN original_dept od
CROSS JOIN actor_profile ap
$$;

COMMIT;
