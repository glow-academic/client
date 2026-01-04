-- Duplicate persona - fetches original and creates copy with prompt and department links in single query
-- Converted to function
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_duplicate_persona_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_duplicate_persona_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_duplicate_persona_v4(
    persona_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    new_persona_id uuid,
    original_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT persona_id AS persona_id,
           profile_id AS profile_id
),
user_profile AS (
    SELECT 
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
original_persona AS (
    SELECT 
        p.id,
        p.name,
        p.description,
        p.color,
        p.icon
    FROM params x
    JOIN personas p ON p.id = x.persona_id
),
original_departments AS (
    -- Get department IDs from original persona
    SELECT department_id
    FROM params x
    JOIN persona_departments pd ON pd.persona_id = x.persona_id AND pd.active = true
),
new_persona AS (
    INSERT INTO personas (
        name,
        description,
        color,
        icon,
        active,
        created_at,
        updated_at
    )
    SELECT 
        op.name || ' Copy',
        COALESCE(op.description, ''),
        op.color,
        op.icon,
        false,
        NOW(),
        NOW()
    FROM original_persona op
    RETURNING id
),
copy_departments AS (
    -- Copy department links from original persona
    INSERT INTO persona_departments (persona_id, department_id, active, created_at, updated_at)
    SELECT 
        np.id,
        od.department_id,
        true,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN original_departments od
    RETURNING persona_id
)
SELECT 
    (SELECT id FROM new_persona LIMIT 1) as new_persona_id,
    (SELECT name FROM original_persona LIMIT 1) as original_name,
    (SELECT actor_name FROM user_profile LIMIT 1) as actor_name
$$;