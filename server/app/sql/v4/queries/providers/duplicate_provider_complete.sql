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
    SELECT actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
original_provider AS (
    SELECT 
        pr.id,
        (SELECT n.name FROM provider_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.provider_id = pr.id LIMIT 1),
        (SELECT d.description FROM provider_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.provider_id = pr.id LIMIT 1)
    FROM params x
    JOIN provider_artifact pr ON pr.id = x.provider_id
),
original_flags AS (
    -- Get flag IDs from original provider
    SELECT flag_id
    FROM params x
    JOIN provider_flags_junction pf ON pf.provider_id = x.provider_id
),
-- Insert name INTO names_resource table
new_name_resource AS (
    INSERT INTO names_resource (name, created_at)
    SELECT name || ' Copy', NOW()
    FROM original_provider
    WHERE name IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as name_id, name
),
-- Insert description INTO descriptions_resource table
new_description_resource AS (
    INSERT INTO descriptions_resource (description, created_at)
    SELECT description, NOW()
    FROM original_provider
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET created_at = EXCLUDED.created_at
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
    INSERT INTO provider_names_junction (provider_id, name_id, created_at)
    SELECT 
        np.id,
        nnr.name_id,
        NOW()
    FROM new_provider np
    CROSS JOIN new_name_resource nnr
    ON CONFLICT (provider_id, name_id) DO NOTHING
),
-- Link provider to description
link_provider_description AS (
    INSERT INTO provider_descriptions_junction (provider_id, description_id, created_at)
    SELECT 
        np.id,
        ndr.description_id,
        NOW()
    FROM new_provider np
    CROSS JOIN new_description_resource ndr
    ON CONFLICT (provider_id, description_id) DO NOTHING
),
-- Link provider active flag (set to false for duplicate)
link_provider_active_flag AS (
    INSERT INTO provider_flags_junction (provider_id, flag_id, value, created_at) SELECT np.id,
        f.id,
        FALSE,
        NOW()
    FROM new_provider np
    CROSS JOIN flags_resource f
    WHERE f.name = 'provider_active'
    ON CONFLICT (provider_id, flag_id) DO UPDATE SET 
        value = FALSE
),
-- Copy other flags from original provider
copy_provider_flags AS (
    INSERT INTO provider_flags_junction (provider_id, flag_id, value, created_at)
    SELECT 
        np.id,
        of.flag_id,
        FALSE,
        NOW()
    FROM new_provider np
    CROSS JOIN original_flags of
    ON CONFLICT (provider_id, flag_id) DO UPDATE SET 
        value = FALSE
)
SELECT 
    (SELECT id FROM new_provider LIMIT 1) as new_provider_id,
    (SELECT name FROM original_provider LIMIT 1) as original_name,
    (SELECT actor_name FROM user_profile LIMIT 1) as actor_name
$$;
