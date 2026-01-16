-- Duplicate provider - fetches original and creates copy with resource links in single query
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
        WHERE proname = 'api_duplicate_provider_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_duplicate_provider_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_duplicate_provider_v4(
    provider_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    new_provider_id uuid,
    original_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT provider_id AS provider_id,
           profile_id AS profile_id
),
user_profile AS (
    SELECT 
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
original_provider AS (
    SELECT 
        pr.id,
        (SELECT n.name FROM provider_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.provider_id = pr.id LIMIT 1),
        (SELECT d.description FROM provider_descriptions pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.provider_id = pr.id LIMIT 1)
    FROM params x
    JOIN provider_artifact pr ON pr.id = x.provider_id
),
original_flags AS (
    -- Get flag IDs from original provider
    SELECT flag_id
    FROM params x
    JOIN provider_flags pf ON pf.provider_id = x.provider_id
),
-- Insert name INTO names_resource table
new_name_resource AS (
    INSERT INTO names_resource (name, created_at, updated_at)
    SELECT name || ' Copy', NOW(), NOW()
    FROM original_provider
    WHERE name IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id, name
),
-- Insert description INTO descriptions_resource table
new_description_resource AS (
    INSERT INTO descriptions_resource (description, created_at, updated_at)
    SELECT description, NOW(), NOW()
    FROM original_provider
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id, description
),
new_provider AS (
    INSERT INTO provider_artifact (
        created_at,
        updated_at
    )
    SELECT 
        NOW(),
        NOW()
    FROM original_provider op
    RETURNING id
),
-- Link provider to name
link_provider_name AS (
    INSERT INTO provider_names (provider_id, name_id, created_at, updated_at)
    SELECT 
        np.id,
        nnr.name_id,
        NOW(),
        NOW()
    FROM new_provider np
    CROSS JOIN new_name_resource nnr
    ON CONFLICT (provider_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Link provider to description
link_provider_description AS (
    INSERT INTO provider_descriptions (provider_id, description_id, created_at, updated_at)
    SELECT 
        np.id,
        ndr.description_id,
        NOW(),
        NOW()
    FROM new_provider np
    CROSS JOIN new_description_resource ndr
    ON CONFLICT (provider_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Link provider active flag (set to false for duplicate)
link_provider_active_flag AS (
    INSERT INTO provider_flags (provider_id, flag_id, value, created_at, updated_at) SELECT np.id,
        f.id,
        FALSE,
        NOW(),
        NOW()
    FROM new_provider np
    CROSS JOIN flags_resource f
    WHERE f.name = 'active'
    ON CONFLICT (provider_id, flag_id) DO UPDATE SET 
        value = FALSE,
        updated_at = NOW()
),
-- Copy other flags from original provider
copy_provider_flags AS (
    INSERT INTO provider_flags (provider_id, flag_id, value, created_at, updated_at)
    SELECT 
        np.id,
        of.flag_id,
        FALSE,
        NOW(),
        NOW()
    FROM new_provider np
    CROSS JOIN original_flags of
    ON CONFLICT (provider_id, flag_id) DO UPDATE SET 
        value = FALSE,
        updated_at = NOW()
)
SELECT 
    (SELECT id FROM new_provider LIMIT 1) as new_provider_id,
    (SELECT name FROM original_provider LIMIT 1) as original_name,
    (SELECT actor_name FROM user_profile LIMIT 1) as actor_name
$$;
