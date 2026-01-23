-- Duplicate eval - fetches original and creates copy with resource links in single query
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
        WHERE proname = 'api_duplicate_eval_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_duplicate_eval_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_duplicate_eval_v4(
    eval_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    new_eval_id uuid,
    original_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT eval_id AS eval_id,
           profile_id AS profile_id
),
user_profile AS (
    SELECT actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
original_eval AS (
    SELECT 
        e.id,
        (SELECT n.name FROM eval_names_junction en JOIN names_resource n ON en.name_id = n.id WHERE en.eval_id = e.id LIMIT 1),
        (SELECT d.description FROM eval_descriptions_junction ed JOIN descriptions_resource d ON ed.description_id = d.id WHERE ed.eval_id = e.id LIMIT 1)
    FROM params x
    JOIN eval_artifact e ON e.id = x.eval_id
),
original_departments AS (
    -- Get department IDs from original eval
    SELECT department_id
    FROM params x
    JOIN eval_departments_junction ed ON ed.eval_id = x.eval_id AND ed.active = true
),
original_agents AS (
    -- Get agent IDs from original eval
    SELECT agent_id
    FROM params x
    JOIN eval_agents_junction ea ON ea.eval_id = x.eval_id
),
original_flags AS (
    -- Get flag IDs from original eval (excluding active flag which is handled separately)
    SELECT ef.flag_id
    FROM params x
    JOIN eval_flags_junction ef ON ef.eval_id = x.eval_id
    JOIN flags_resource f ON ef.flag_id = f.id
    WHERE f.name != 'active'
),
-- Insert name INTO names_resource table
new_name_resource AS (
    INSERT INTO names_resource (name, created_at)
    SELECT name || ' Copy', NOW()
    FROM original_eval
    WHERE name IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as name_id, name
),
-- Insert description INTO descriptions_resource table
new_description_resource AS (
    INSERT INTO descriptions_resource (description, created_at)
    SELECT description, NOW()
    FROM original_eval
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as description_id, description
),
new_eval AS (
    INSERT INTO eval_artifact (
        created_at,
        updated_at
    )
    SELECT 
        NOW(),
        NOW()
    FROM original_eval oe
    RETURNING id
),
-- Link eval to name
link_eval_name AS (
    INSERT INTO eval_names_junction (eval_id, name_id, created_at)
    SELECT 
        ne.id,
        nnr.name_id,
        NOW()
    FROM new_eval ne
    CROSS JOIN new_name_resource nnr
    ON CONFLICT (eval_id, name_id) DO NOTHING
),
-- Link eval to description
link_eval_description AS (
    INSERT INTO eval_descriptions_junction (eval_id, description_id, created_at)
    SELECT 
        ne.id,
        ndr.description_id,
        NOW()
    FROM new_eval ne
    CROSS JOIN new_description_resource ndr
    ON CONFLICT (eval_id, description_id) DO NOTHING
),
-- Link eval active flag (set to false for duplicate)
link_eval_active_flag AS (
    INSERT INTO eval_flags_junction (eval_id, flag_id, value, created_at) SELECT ne.id,
        f.id,
        FALSE,
        NOW()
    FROM new_eval ne
    CROSS JOIN flags_resource f
    WHERE f.name = 'eval_active'
    ON CONFLICT (eval_id, flag_id) DO UPDATE SET 
        value = FALSE
),
-- Copy other flags from original eval
copy_eval_flags AS (
    INSERT INTO eval_flags_junction (eval_id, flag_id, value, created_at)
    SELECT 
        ne.id,
        of.flag_id,
        FALSE,
        NOW()
    FROM new_eval ne
    CROSS JOIN original_flags of
    ON CONFLICT (eval_id, flag_id) DO UPDATE SET 
        value = FALSE
),
copy_departments AS (
    -- Copy department links from original eval
    INSERT INTO eval_departments_junction (eval_id, department_id, active, created_at)
    SELECT 
        ne.id,
        od.department_id,
        true,
        NOW()
    FROM new_eval ne
    CROSS JOIN original_departments od
    RETURNING eval_id
),
copy_agents AS (
    -- Copy agent links from original eval
    INSERT INTO eval_agents_junction (eval_id, agent_id, created_at)
    SELECT 
        ne.id,
        oa.agent_id,
        NOW()
    FROM new_eval ne
    CROSS JOIN original_agents oa
    RETURNING eval_id
)
SELECT 
    (SELECT id FROM new_eval LIMIT 1) as new_eval_id,
    (SELECT name FROM original_eval LIMIT 1) as original_name,
    (SELECT actor_name FROM user_profile LIMIT 1) as actor_name
$$;
