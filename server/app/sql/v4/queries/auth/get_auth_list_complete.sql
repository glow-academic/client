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
    auths types.q_get_auth_list_v4_auth[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
-- User context: actor_name comes from get_profile_context_internal() in Python
user_profile AS (
    SELECT COALESCE(r.role, 'member'::profile_type) as role,
           ''::text as actor_name
    FROM profile_roles_junction prj
    JOIN roles_resource r ON prj.role_id = r.id
    WHERE prj.profile_id = (SELECT profile_id FROM params)
    LIMIT 1
),
auth_item_counts AS (
    SELECT
        aaj.auths_id,
        COUNT(*) as num_items
    FROM auth_auths_junction aaj
    JOIN auth_items_junction ai_j ON ai_j.auth_id = aaj.auth_id
    JOIN items_resource i ON i.id = ai_j.item_id
    GROUP BY aaj.auths_id
),
auth_sample_items AS (
    SELECT
        ai.auths_id,
        ARRAY_AGG(
            (ai.id, ai.name, ai.description)::types.q_get_auth_list_v4_auth_item
            ORDER BY ai.name
        ) as sample_items
    FROM (
        SELECT i.id, aaj.auths_id, i.name, i.description,
               ROW_NUMBER() OVER (PARTITION BY aaj.auths_id ORDER BY i.name) as rn
        FROM auth_auths_junction aaj
        JOIN auth_items_junction ai_j ON ai_j.auth_id = aaj.auth_id
        JOIN items_resource i ON i.id = ai_j.item_id
    ) ai
    WHERE ai.rn <= 3
    GROUP BY ai.auths_id
)
SELECT
    COALESCE(
        ARRAY_AGG(
            (a.id, (SELECT n.name FROM auth_auths_junction aaj_n JOIN auth_names_junction an ON an.auth_id = aaj_n.auth_id JOIN names_resource n ON an.name_id = n.id WHERE aaj_n.auths_id = a.id LIMIT 1), (SELECT d.description FROM auth_auths_junction aaj_d JOIN auth_descriptions_junction ad ON ad.auth_id = aaj_d.auth_id JOIN descriptions_resource d ON ad.description_id = d.id WHERE aaj_d.auths_id = a.id LIMIT 1), EXISTS (SELECT 1 FROM auth_auths_junction aaj_f JOIN auth_flags_junction af ON af.auth_id = aaj_f.auth_id JOIN flags_resource f ON af.flag_id = f.id WHERE aaj_f.auths_id = a.id AND f.name = 'auth_active' AND af.value = TRUE), a.created_at,
             COALESCE(aic.num_items, 0),
             COALESCE(asi.sample_items, '{}'::types.q_get_auth_list_v4_auth_item[]),
             CASE WHEN up.role IN ('admin'::profile_type, 'superadmin'::profile_type) THEN true ELSE false END,
             CASE WHEN up.role IN ('admin'::profile_type, 'superadmin'::profile_type) THEN true ELSE false END,
             CASE WHEN up.role IN ('admin'::profile_type, 'superadmin'::profile_type) THEN true ELSE false END
            )::types.q_get_auth_list_v4_auth
            ORDER BY a.created_at DESC NULLS LAST
        ),
        '{}'::types.q_get_auth_list_v4_auth[]
    ) as auths
FROM auths_resource a
LEFT JOIN auth_item_counts aic ON aic.auths_id = a.id
LEFT JOIN auth_sample_items asi ON asi.auths_id = a.id
CROSS JOIN user_profile up
GROUP BY up.actor_name, up.role
$$;
