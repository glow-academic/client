-- Unified save provider function - handles create and update.

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
    endpoint_id uuid DEFAULT NULL,
    key_id uuid DEFAULT NULL,
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
BEGIN
    SELECT up.actor_name INTO v_actor_name
    FROM view_user_profile_context up
    WHERE up.profile_id = api_save_provider_v4.profile_id;

    IF name_id IS NULL THEN
        RAISE EXCEPTION 'Name resource is required';
    END IF;
    IF value_id IS NULL THEN
        RAISE EXCEPTION 'Value resource is required';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM names_resource WHERE id = name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', name_id;
    END IF;
    IF description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', description_id;
    END IF;
    IF active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', active_flag_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM values_resource WHERE id = value_id) THEN
        RAISE EXCEPTION 'Value resource not found: %', value_id;
    END IF;
    IF endpoint_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM endpoints_resource WHERE id = endpoint_id) THEN
        RAISE EXCEPTION 'Endpoint resource not found: %', endpoint_id;
    END IF;
    IF key_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM keys_resource WHERE id = key_id) THEN
        RAISE EXCEPTION 'Key resource not found: %', key_id;
    END IF;

    IF input_provider_id IS NULL THEN
        INSERT INTO provider_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_provider_id;
    ELSE
        v_provider_id := input_provider_id;
        UPDATE provider_artifact
        SET updated_at = NOW()
        WHERE id = v_provider_id;

        DELETE FROM provider_names_junction WHERE provider_names_junction.provider_id = v_provider_id;
        DELETE FROM provider_descriptions_junction WHERE provider_descriptions_junction.provider_id = v_provider_id;
        DELETE FROM provider_values_junction WHERE provider_values_junction.provider_id = v_provider_id;
        DELETE FROM provider_endpoints_junction WHERE provider_endpoints_junction.provider_id = v_provider_id;
        DELETE FROM provider_keys_junction WHERE provider_keys_junction.provider_id = v_provider_id;
        DELETE FROM provider_departments_junction WHERE provider_departments_junction.provider_id = v_provider_id;
    END IF;

    INSERT INTO provider_names_junction (provider_id, name_id, created_at, active)
    VALUES (v_provider_id, name_id, NOW(), true)
    ON CONFLICT ON CONSTRAINT provider_names_pkey DO UPDATE SET active = true;

    IF description_id IS NOT NULL THEN
        INSERT INTO provider_descriptions_junction (provider_id, description_id, created_at, active)
        VALUES (v_provider_id, description_id, NOW(), true)
        ON CONFLICT ON CONSTRAINT provider_descriptions_pkey DO UPDATE SET active = true;
    END IF;

    INSERT INTO provider_flags_junction (provider_id, flag_id, value, created_at, active)
    SELECT
        v_provider_id,
        COALESCE(active_flag_id, f.id),
        CASE WHEN active_flag_id IS NOT NULL THEN true ELSE false END,
        NOW(),
        true
    FROM flags_resource f
    WHERE f.name = 'provider_active'
    ON CONFLICT ON CONSTRAINT provider_flags_pkey DO UPDATE SET
        flag_id = COALESCE(EXCLUDED.flag_id, provider_flags_junction.flag_id),
        value = EXCLUDED.value,
        active = true;

    INSERT INTO provider_values_junction (provider_id, values_id, created_at, active)
    VALUES (v_provider_id, value_id, NOW(), true)
    ON CONFLICT ON CONSTRAINT provider_values_pkey DO UPDATE SET active = true;

    IF endpoint_id IS NOT NULL THEN
        INSERT INTO provider_endpoints_junction (provider_id, endpoint_id, created_at, active)
        VALUES (v_provider_id, endpoint_id, NOW(), true)
        ON CONFLICT ON CONSTRAINT provider_endpoints_junction_pkey DO UPDATE SET active = true;
    END IF;

    IF key_id IS NOT NULL THEN
        INSERT INTO provider_keys_junction (provider_id, key_id, created_at, active)
        VALUES (v_provider_id, key_id, NOW(), true)
        ON CONFLICT ON CONSTRAINT provider_keys_junction_pkey DO UPDATE SET active = true;
    END IF;

    IF department_ids IS NOT NULL AND array_length(department_ids, 1) > 0 THEN
        INSERT INTO provider_departments_junction (provider_id, department_id, created_at, active)
        SELECT v_provider_id, did, NOW(), true
        FROM unnest(department_ids) AS did
        ON CONFLICT ON CONSTRAINT provider_departments_pkey DO UPDATE SET active = true;
    END IF;

    UPDATE providers_resource r
    SET
        name = n.name,
        description = d.description,
        value = v.value,
        endpoint = e.base_url,
        key = k.key,
        updated_at = NOW()
    FROM provider_providers_junction j
    LEFT JOIN names_resource n ON n.id = name_id
    LEFT JOIN descriptions_resource d ON d.id = description_id
    LEFT JOIN values_resource v ON v.id = value_id
    LEFT JOIN endpoints_resource e ON e.id = endpoint_id
    LEFT JOIN keys_resource k ON k.id = key_id
    WHERE j.providers_id = r.id
      AND j.provider_id = v_provider_id;

    RETURN QUERY
    SELECT
        v_provider_id AS provider_id,
        v_actor_name AS actor_name;
END;
$$;
