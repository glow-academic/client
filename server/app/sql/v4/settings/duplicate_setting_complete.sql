-- Duplicate setting - fetches original and creates copy with resource links in single query
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
        WHERE proname = 'api_duplicate_setting_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_duplicate_setting_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_duplicate_setting_v4(
    setting_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    new_setting_id uuid,
    original_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT setting_id AS setting_id,
           profile_id AS profile_id
),
user_profile AS (
    SELECT 
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
original_setting AS (
    SELECT 
        s.id,
        (SELECT n.name FROM setting_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.setting_id = s.id LIMIT 1),
        (SELECT d.description FROM setting_descriptions sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.setting_id = s.id LIMIT 1)
    FROM params x
    JOIN setting_artifact s ON s.id = x.setting_id
),
original_flags AS (
    -- Get flag IDs from original setting (excluding active flag which is handled separately)
    SELECT sf.flag_id
    FROM params x
    JOIN setting_flags sf ON sf.setting_id = x.setting_id
    JOIN flags_resource f ON sf.flag_id = f.id
    WHERE f.name != 'active'
),
-- Insert name INTO names_resource table
new_name_resource AS (
    INSERT INTO names_resource (name, created_at, updated_at)
    SELECT name || ' Copy', NOW(), NOW()
    FROM original_setting
    WHERE name IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id, name
),
-- Insert description INTO descriptions_resource table
new_description_resource AS (
    INSERT INTO descriptions_resource (description, created_at, updated_at)
    SELECT description, NOW(), NOW()
    FROM original_setting
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id, description
),
new_setting AS (
    INSERT INTO setting_artifact (
        created_at,
        updated_at
    )
    SELECT 
        NOW(),
        NOW()
    FROM original_setting os
    RETURNING id
),
-- Link setting to name
link_setting_name AS (
    INSERT INTO setting_names (setting_id, name_id, created_at, updated_at)
    SELECT 
        ns.id,
        nnr.name_id,
        NOW(),
        NOW()
    FROM new_setting ns
    CROSS JOIN new_name_resource nnr
    ON CONFLICT (setting_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Link setting to description
link_setting_description AS (
    INSERT INTO setting_descriptions (setting_id, description_id, created_at, updated_at)
    SELECT 
        ns.id,
        ndr.description_id,
        NOW(),
        NOW()
    FROM new_setting ns
    CROSS JOIN new_description_resource ndr
    ON CONFLICT (setting_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Link setting active flag (set to false for duplicate)
link_setting_active_flag AS (
    INSERT INTO setting_flags (setting_id, flag_id, value, created_at, updated_at) SELECT ns.id,
        f.id,
        FALSE,
        NOW(),
        NOW()
    FROM new_setting ns
    CROSS JOIN flags_resource f
    WHERE f.name = 'active'
    ON CONFLICT (setting_id, flag_id) DO UPDATE SET 
        value = FALSE,
        updated_at = NOW()
),
-- Copy other flags from original setting
copy_setting_flags AS (
    INSERT INTO setting_flags (setting_id, flag_id, value, created_at, updated_at)
    SELECT 
        ns.id,
        of.flag_id,
        FALSE,
        NOW(),
        NOW()
    FROM new_setting ns
    CROSS JOIN original_flags of
    ON CONFLICT (setting_id, flag_id) DO UPDATE SET 
        value = FALSE,
        updated_at = NOW()
)
SELECT 
    (SELECT id FROM new_setting LIMIT 1) as new_setting_id,
    (SELECT name FROM original_setting LIMIT 1) as original_name,
    (SELECT actor_name FROM user_profile LIMIT 1) as actor_name
$$;
