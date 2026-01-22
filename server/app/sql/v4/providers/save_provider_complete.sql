-- Unified save provider function - handles both create (provider_id = NULL) and update (provider_id provided)
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
        WHERE proname = 'api_save_provider_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_provider_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_save_provider_v4(
    draft_id uuid,
    profile_id uuid,
    input_provider_id uuid DEFAULT NULL
)
RETURNS TABLE (
    provider_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_provider_id uuid;
    v_actor_name text;
    v_group_id uuid;
    v_draft_id uuid;
    v_profile_id uuid;
    v_input_provider_id uuid;
    is_create boolean;
    v_name_id uuid;
    v_description_id uuid;
    v_active_flag_id uuid;
BEGIN
    v_draft_id := draft_id;
    v_profile_id := profile_id;
    v_input_provider_id := input_provider_id;

    IF v_draft_id IS NULL THEN
        RAISE EXCEPTION 'Draft ID is required';
    END IF;

    SELECT d.group_id INTO v_group_id
    FROM resource_drafts d
    WHERE d.id = v_draft_id;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'Draft group_id not found: %', v_draft_id;
    END IF;

    SELECT dn.names_id INTO v_name_id
    FROM names_draft dn
    WHERE dn.draft_id = v_draft_id
    LIMIT 1;

    SELECT dd.descriptions_id INTO v_description_id
    FROM descriptions_draft dd
    WHERE dd.draft_id = v_draft_id
    LIMIT 1;

    SELECT df.flags_id INTO v_active_flag_id
    FROM flags_draft df
    WHERE df.draft_id = v_draft_id
    LIMIT 1;
    -- Determine if create or update
    is_create := (v_input_provider_id IS NULL);
    
    -- Create or UPDATE provider_artifact first (outside CTE)
    IF is_create THEN
        -- CREATE path - use draft group_id
        INSERT INTO provider_artifact (group_id, created_at, updated_at)
        VALUES (v_group_id, NOW(), NOW())
        RETURNING id INTO v_provider_id;
    ELSE
        -- UPDATE path
        v_provider_id := v_input_provider_id;
        UPDATE provider_artifact
        SET updated_at = NOW(),
            group_id = v_group_id
        WHERE id = v_provider_id;
    END IF;
    
    -- Validate required resource IDs exist (same for both)
    IF v_name_id IS NULL THEN
        RAISE EXCEPTION 'Name resource is required';
    END IF;

    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;
    
    IF v_description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = v_description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', v_description_id;
    END IF;
    
    IF v_active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_active_flag_id;
    END IF;
    
    -- Conditional: For update, remove old links first (outside CTE since we need PL/pgSQL variable)
    IF NOT is_create THEN
        DELETE FROM provider_names WHERE provider_names.provider_id = v_provider_id;
        DELETE FROM provider_descriptions WHERE provider_descriptions.provider_id = v_provider_id;
        -- Update existing active flag if it exists
        UPDATE provider_flags SET
            flag_id = COALESCE(v_active_flag_id, provider_flags.flag_id),
            value = CASE WHEN v_active_flag_id IS NOT NULL THEN true ELSE false END,
            updated_at = NOW()
        WHERE provider_flags.provider_id = v_provider_id
          ;
    END IF;
    
    -- Continue with provider save using SQL (provider already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_provider_id AS p_provider_id,
            v_name_id AS name_id,
            v_description_id AS description_id,
            v_active_flag_id AS active_flag_id,
            v_profile_id AS profile_id
    ),
    user_profile AS (
        SELECT 
            (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) as role,
            COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as actor_name
        FROM params x
        JOIN profile_artifact p ON p.id = x.profile_id
    ),
    actor_profile AS (
        SELECT 
            x.profile_id,
            up.actor_name
        FROM params x
        CROSS JOIN user_profile up
    ),
    -- Link provider to name
    link_provider_name AS (
        INSERT INTO provider_names (provider_id, name_id, created_at, updated_at)
        SELECT 
            x.p_provider_id,
            x.name_id,
            NOW(),
            NOW()
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT provider_names_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Link provider to description
    link_provider_description AS (
        INSERT INTO provider_descriptions (provider_id, description_id, created_at, updated_at)
        SELECT 
            x.p_provider_id,
            x.description_id,
            NOW(),
            NOW()
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT provider_descriptions_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Insert or UPDATE provider_artifact active flag (UPDATE handled above for update case, INSERT here handles both via ON CONFLICT)
    insert_provider_active_flag AS (
        INSERT INTO provider_flags (provider_id, flag_id, value, created_at, updated_at) SELECT x.p_provider_id,
            COALESCE(x.active_flag_id, f.id),
            CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'provider_active'
        ON CONFLICT ON CONSTRAINT provider_flags_pkey DO UPDATE SET 
            flag_id = COALESCE(EXCLUDED.flag_id, provider_flags.flag_id),
            value = EXCLUDED.value,
            updated_at = NOW()
    )
    SELECT 
        x.p_provider_id AS provider_id,
        ap.actor_name AS actor_name
    FROM params x
    CROSS JOIN actor_profile ap;
END;
$$;
