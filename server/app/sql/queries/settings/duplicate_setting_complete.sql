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
    original_name text
)
LANGUAGE sql
VOLATILE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT setting_id AS setting_id,
           profile_id AS profile_id
),
original_setting AS (
    SELECT
        s.id,
        (SELECT n.name FROM setting_names_junction sn JOIN names_resource n ON sn.names_id = n.id WHERE sn.setting_id = s.id LIMIT 1) as name,
        (SELECT sd.descriptions_id FROM setting_descriptions_junction sd WHERE sd.setting_id = s.id LIMIT 1) as descriptions_id
    FROM params x
    JOIN setting_artifact s ON s.id = x.setting_id
),
original_flags AS (
    -- Get flag IDs from original setting (excluding active flag which is handled separately)
    SELECT sf.flags_id
    FROM params x
    JOIN setting_flags_junction sf ON sf.setting_id = x.setting_id
    JOIN flags_resource f ON sf.flags_id = f.id
    WHERE f.name != 'setting_active'
),
-- Insert name INTO names_resource table
new_name_resource AS (
    INSERT INTO names_resource (name, created_at)
    SELECT name || ' Copy', NOW()
    FROM original_setting
    WHERE name IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as names_id, name
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
    INSERT INTO setting_names_junction (setting_id, names_id, created_at)
    SELECT 
        ns.id,
        nnr.names_id,
        NOW()
    FROM new_setting ns
    CROSS JOIN new_name_resource nnr
    ON CONFLICT (setting_id, names_id) DO NOTHING
),
-- Link setting to existing description (like personas pattern)
link_setting_description AS (
    INSERT INTO setting_descriptions_junction (setting_id, descriptions_id, created_at)
    SELECT
        ns.id,
        os.descriptions_id,
        NOW()
    FROM new_setting ns
    CROSS JOIN original_setting os
    WHERE os.descriptions_id IS NOT NULL
),
-- Link setting active flag (set to false for duplicate)
link_setting_active_flag AS (
    INSERT INTO setting_flags_junction (setting_id, flags_id, created_at) SELECT ns.id,
        f.id,
        NOW()
    FROM new_setting ns
    CROSS JOIN flags_resource f
    WHERE f.name = 'setting_active'
    ON CONFLICT (setting_id, flags_id) DO NOTHING
),
-- Copy other flags from original setting
copy_setting_flags AS (
    INSERT INTO setting_flags_junction (setting_id, flags_id, created_at)
    SELECT
        ns.id,
        of.flags_id,
        NOW()
    FROM new_setting ns
    CROSS JOIN original_flags of
    ON CONFLICT (setting_id, flags_id) DO NOTHING
)
SELECT 
    (SELECT id FROM new_setting LIMIT 1) as new_setting_id,
    (SELECT name FROM original_setting LIMIT 1) as original_name
$$;

