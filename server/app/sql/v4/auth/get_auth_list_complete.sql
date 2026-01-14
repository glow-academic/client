-- Get auth list with item counts and permissions
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_auth_list_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_auth_list_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITH CASCADE (needed for nested composite types)
-- Drop all types matching prefix pattern to handle type additions/removals
-- CASCADE is needed because outer types contain arrays of inner types
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_auth_list_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_auth_list_v4_auth_item AS (
    auth_item_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_auth_list_v4_auth AS (
    auth_id uuid,
    name text,
    description text,
    active boolean,
    updated_at timestamptz,
    num_items integer,
    sample_items types.q_get_auth_list_v4_auth_item[],
    can_edit boolean,
    can_delete boolean,
    can_duplicate boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_auth_list_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    auths types.q_get_auth_list_v4_auth[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_profile AS (
    SELECT 
        (SELECT r.role FROM profile_roles pr_j 
         JOIN roles_resource r ON pr_j.role_id = r.id 
         WHERE pr_j.profile_id = p.id 
         LIMIT 1) as role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
auth_item_counts AS (
    SELECT 
        ai_j.auth_id,
        COUNT(*) as num_items
    FROM auth_items ai_j
    JOIN items_resource i ON i.id = ai_j.item_id
    GROUP BY ai_j.auth_id
),
auth_sample_items AS (
    SELECT 
        ai.auth_id,
        ARRAY_AGG(
            (ai.id, ai.name, ai.description)::types.q_get_auth_list_v4_auth_item
            ORDER BY ai.name
        ) as sample_items
    FROM (
        SELECT i.id, ai_j.auth_id, i.name, i.description,
               ROW_NUMBER() OVER (PARTITION BY ai_j.auth_id ORDER BY i.name) as rn
        FROM auth_items ai_j
        JOIN items_resource i ON i.id = ai_j.item_id
    ) ai
    WHERE ai.rn <= 3
    GROUP BY ai.auth_id
)
SELECT 
    up.actor_name::text as actor_name,
    COALESCE(
        ARRAY_AGG(
            (a.id, (SELECT n.name FROM auth_names an JOIN names_resource n ON an.name_id = n.id WHERE an.auth_id = a.id LIMIT 1), (SELECT d.description FROM auth_descriptions ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE ad.auth_id = a.id LIMIT 1), EXISTS (SELECT 1 FROM auth_flags af WHERE af.auth_id = a.id AND af.type = 'active'::type_auth_flags AND af.value = TRUE), a.updated_at,
             COALESCE(aic.num_items, 0),
             COALESCE(asi.sample_items, '{}'::types.q_get_auth_list_v4_auth_item[]),
             CASE WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true ELSE false END,
             CASE WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true ELSE false END,
             CASE WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true ELSE false END
            )::types.q_get_auth_list_v4_auth
            ORDER BY a.updated_at DESC NULLS LAST
        ),
        '{}'::types.q_get_auth_list_v4_auth[]
    ) as auths
FROM auths_resource a
LEFT JOIN auth_item_counts aic ON aic.auth_id = a.id
LEFT JOIN auth_sample_items asi ON asi.auth_id = a.id
CROSS JOIN user_profile up
GROUP BY up.actor_name, up.role
$$;