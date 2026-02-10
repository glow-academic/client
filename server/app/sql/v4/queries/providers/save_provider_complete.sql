-- Unified save provider function - handles both create (input_provider_id = NULL) and update
-- Accepts all resource IDs directly (no draft_id dependency)
-- 1) Drop function first
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
    profile_id uuid,
    group_id uuid,
    input_provider_id uuid DEFAULT NULL,
    name_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    value_id uuid DEFAULT NULL,
    regenerates_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[]
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
    is_create boolean;
BEGIN
    -- Get actor name
    SELECT up.actor_name INTO v_actor_name
    FROM view_user_profile_context up
    WHERE up.profile_id = api_save_provider_v4.profile_id;

    -- Validate required resource IDs
    IF name_id IS NULL THEN
        RAISE EXCEPTION 'Name resource is required';
    END IF;

    IF name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', name_id;
    END IF;

    IF description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', description_id;
    END IF;

    IF active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', active_flag_id;
    END IF;

    IF value_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM values_resource WHERE id = value_id) THEN
        RAISE EXCEPTION 'Value resource not found: %', value_id;
    END IF;

    IF regenerates_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM regenerates_resource WHERE id = regenerates_id) THEN
        RAISE EXCEPTION 'Regenerates resource not found: %', regenerates_id;
    END IF;

    -- Determine if create or update
    is_create := (input_provider_id IS NULL);

    IF is_create THEN
        -- CREATE path
        INSERT INTO provider_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_provider_id;

    ELSE
        -- UPDATE path
        v_provider_id := input_provider_id;
        UPDATE provider_artifact
        SET updated_at = NOW()
        WHERE id = v_provider_id;

        -- Remove old junction links
        DELETE FROM provider_names_junction WHERE provider_names_junction.provider_id = v_provider_id;
        DELETE FROM provider_descriptions_junction WHERE provider_descriptions_junction.provider_id = v_provider_id;
        DELETE FROM provider_values_junction WHERE provider_values_junction.provider_id = v_provider_id;
        DELETE FROM provider_regenerates_junction WHERE provider_regenerates_junction.provider_id = v_provider_id;
        DELETE FROM provider_departments_junction WHERE provider_departments_junction.provider_id = v_provider_id;
    END IF;

    -- Link provider to name
    IF name_id IS NOT NULL THEN
        INSERT INTO provider_names_junction (provider_id, name_id, created_at)
        VALUES (v_provider_id, name_id, NOW())
        ON CONFLICT ON CONSTRAINT provider_names_pkey DO NOTHING;
    END IF;

    -- Link provider to description
    IF description_id IS NOT NULL THEN
        INSERT INTO provider_descriptions_junction (provider_id, description_id, created_at)
        VALUES (v_provider_id, description_id, NOW())
        ON CONFLICT ON CONSTRAINT provider_descriptions_pkey DO NOTHING;
    END IF;

    -- Link provider to active flag
    INSERT INTO provider_flags_junction (provider_id, flag_id, value, created_at)
    SELECT v_provider_id,
        COALESCE(active_flag_id, f.id),
        CASE WHEN active_flag_id IS NOT NULL THEN true ELSE false END,
        NOW()
    FROM flags_resource f
    WHERE f.name = 'provider_active'
    ON CONFLICT ON CONSTRAINT provider_flags_pkey DO UPDATE SET
        flag_id = COALESCE(EXCLUDED.flag_id, provider_flags_junction.flag_id),
        value = EXCLUDED.value;

    -- Link provider to value
    IF value_id IS NOT NULL THEN
        INSERT INTO provider_values_junction (provider_id, values_id, created_at)
        VALUES (v_provider_id, value_id, NOW())
        ON CONFLICT ON CONSTRAINT provider_values_pkey DO NOTHING;
    END IF;

    -- Link provider to regenerates
    IF regenerates_id IS NOT NULL THEN
        INSERT INTO provider_regenerates_junction (provider_id, regenerates_id, created_at)
        VALUES (v_provider_id, regenerates_id, NOW())
        ON CONFLICT ON CONSTRAINT provider_regenerates_junction_pkey DO NOTHING;
    END IF;

    -- Link provider to departments
    IF department_ids IS NOT NULL AND array_length(department_ids, 1) > 0 THEN
        INSERT INTO provider_departments_junction (provider_id, department_id, created_at)
        SELECT v_provider_id, did, NOW()
        FROM unnest(department_ids) AS did
        ON CONFLICT ON CONSTRAINT provider_departments_pkey DO NOTHING;
    END IF;

    -- Sync linked resources with name/description
    UPDATE providers_resource r
    SET name = n.name,
        description = d.description
    FROM provider_providers_junction j
    LEFT JOIN names_resource n ON n.id = name_id
    LEFT JOIN descriptions_resource d ON d.id = description_id
    WHERE j.providers_id = r.id
      AND j.provider_id = v_provider_id;

    RETURN QUERY
    SELECT
        v_provider_id AS provider_id,
        v_actor_name AS actor_name;
END;
$$;
