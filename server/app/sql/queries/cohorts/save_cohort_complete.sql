-- Unified save cohort function - handles both create (input_cohort_id = NULL) and update (input_cohort_id provided)
-- Accepts flat resource IDs directly. Tool call tracking handled by create/link internals.
-- Denormalized cohorts_resource created inline or by Python (create_cohorts_internal).

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_save_cohort_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_cohort_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_save_cohort_v4(
    profile_id uuid,
    input_cohort_id uuid DEFAULT NULL,
    names_id uuid DEFAULT NULL,
    descriptions_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    simulation_ids uuid[] DEFAULT NULL,
    simulation_position_ids uuid[] DEFAULT NULL,
    simulation_availability_ids uuid[] DEFAULT NULL,
    profile_ids uuid[] DEFAULT NULL,
    profile_persona_ids uuid[] DEFAULT NULL,
    cohorts_resource_id uuid DEFAULT NULL
)
RETURNS TABLE (
    cohort_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_cohort_id uuid;
    is_create boolean;
BEGIN
    -- Determine if create or update
    is_create := (input_cohort_id IS NULL);

    -- Validate required fields (only on create)
    IF is_create THEN
        IF names_id IS NULL THEN
            RAISE EXCEPTION 'Name resource is required';
        END IF;
    END IF;

    -- Create or update cohort_artifact
    IF is_create THEN
        INSERT INTO cohort_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_cohort_id;
    ELSE
        v_cohort_id := input_cohort_id;
        UPDATE cohort_artifact
        SET updated_at = NOW()
        WHERE id = v_cohort_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cohort not found: %', input_cohort_id;
        END IF;

        -- COALESCE: fill NULL params from existing active junctions (partial update support)
        -- Single-select resources
        IF names_id IS NULL THEN
            names_id := (SELECT j.names_id FROM cohort_names_junction j WHERE j.cohort_id = v_cohort_id AND j.active LIMIT 1);
        END IF;
        IF descriptions_id IS NULL THEN
            descriptions_id := (SELECT j.descriptions_id FROM cohort_descriptions_junction j WHERE j.cohort_id = v_cohort_id AND j.active LIMIT 1);
        END IF;

        -- Multi-select arrays: preserve existing if NULL passed
        IF department_ids IS NULL THEN
            department_ids := COALESCE((SELECT ARRAY_AGG(j.departments_id) FROM cohort_departments_junction j WHERE j.cohort_id = v_cohort_id AND j.active), ARRAY[]::uuid[]);
        END IF;
        IF simulation_ids IS NULL THEN
            simulation_ids := COALESCE((SELECT ARRAY_AGG(j.simulations_id) FROM cohort_simulations_junction j WHERE j.cohort_id = v_cohort_id AND j.active), ARRAY[]::uuid[]);
        END IF;
        IF simulation_position_ids IS NULL THEN
            simulation_position_ids := COALESCE((SELECT ARRAY_AGG(j.simulation_positions_id) FROM cohort_simulation_positions_junction j WHERE j.cohort_id = v_cohort_id AND j.active), ARRAY[]::uuid[]);
        END IF;
        IF simulation_availability_ids IS NULL THEN
            simulation_availability_ids := COALESCE((SELECT ARRAY_AGG(j.simulation_availability_id) FROM cohort_simulation_availability_junction j WHERE j.cohort_id = v_cohort_id AND j.active), ARRAY[]::uuid[]);
        END IF;
        IF profile_ids IS NULL THEN
            profile_ids := COALESCE((SELECT ARRAY_AGG(j.profile_id) FROM cohort_profiles_junction j WHERE j.cohort_id = v_cohort_id AND j.active), ARRAY[]::uuid[]);
        END IF;
        IF profile_persona_ids IS NULL THEN
            profile_persona_ids := COALESCE((SELECT ARRAY_AGG(j.profile_personas_id) FROM cohort_profile_personas_junction j WHERE j.cohort_id = v_cohort_id AND j.active), ARRAY[]::uuid[]);
        END IF;

        -- Flag: preserve existing active flag if not provided
        IF active_flag_id IS NULL THEN
            active_flag_id := (SELECT j.flags_id FROM cohort_flags_junction j JOIN flags_resource fr ON j.flags_id = fr.id WHERE j.cohort_id = v_cohort_id AND fr.value = true LIMIT 1);
        END IF;
    END IF;

    -- Create cohorts_resource inline if not provided (partial update path)
    IF cohorts_resource_id IS NULL THEN
        INSERT INTO cohorts_resource (
            name, description, department_ids, simulation_ids,
            profile_ids, profile_persona_ids, mcp, generated
        )
        SELECT
            n.name,
            d.description,
            COALESCE(api_save_cohort_v4.department_ids, ARRAY[]::uuid[]),
            COALESCE(api_save_cohort_v4.simulation_ids, ARRAY[]::uuid[]),
            COALESCE(api_save_cohort_v4.profile_ids, ARRAY[]::uuid[]),
            COALESCE(api_save_cohort_v4.profile_persona_ids, ARRAY[]::uuid[]),
            false,
            false
        FROM (SELECT 1) AS dummy
        LEFT JOIN names_resource n ON n.id = api_save_cohort_v4.names_id
        LEFT JOIN descriptions_resource d ON d.id = api_save_cohort_v4.descriptions_id
        RETURNING id INTO cohorts_resource_id;
    END IF;

    -- For update: deactivate old junction rows (preserves history)
    IF NOT is_create THEN
        UPDATE cohort_names_junction SET active = false WHERE cohort_id = v_cohort_id AND active = true;
        UPDATE cohort_descriptions_junction SET active = false WHERE cohort_id = v_cohort_id AND active = true;
        UPDATE cohort_flags_junction SET active = false WHERE cohort_id = v_cohort_id AND active = true;
        UPDATE cohort_departments_junction SET active = false WHERE cohort_id = v_cohort_id AND active = true;
        UPDATE cohort_simulations_junction SET active = false WHERE cohort_id = v_cohort_id AND active = true;
        UPDATE cohort_simulation_positions_junction SET active = false WHERE cohort_id = v_cohort_id AND active = true;
        UPDATE cohort_simulation_availability_junction SET active = false WHERE cohort_id = v_cohort_id AND active = true;
        UPDATE cohort_profiles_junction SET active = false WHERE cohort_id = v_cohort_id AND active = true;
        UPDATE cohort_profile_personas_junction SET active = false WHERE cohort_id = v_cohort_id AND active = true;
    END IF;

    -- Upsert junction rows
    RETURN QUERY
    WITH params AS (
        SELECT
            v_cohort_id AS cohort_id,
            api_save_cohort_v4.names_id AS names_id,
            api_save_cohort_v4.descriptions_id AS descriptions_id,
            api_save_cohort_v4.active_flag_id AS active_flag_id,
            api_save_cohort_v4.department_ids AS department_ids,
            api_save_cohort_v4.simulation_ids AS simulation_ids,
            api_save_cohort_v4.simulation_position_ids AS simulation_position_ids,
            api_save_cohort_v4.simulation_availability_ids AS simulation_availability_ids,
            api_save_cohort_v4.profile_ids AS profile_ids,
            api_save_cohort_v4.profile_persona_ids AS profile_persona_ids,
            api_save_cohort_v4.cohorts_resource_id AS cohorts_resource_id
    ),
    -- Link name
    link_name AS (
        INSERT INTO cohort_names_junction (cohort_id, names_id, active, created_at)
        SELECT x.cohort_id, x.names_id, true, NOW()
        FROM params x
        WHERE x.names_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT cohort_names_pkey DO UPDATE SET active = true
    ),
    -- Link description
    link_description AS (
        INSERT INTO cohort_descriptions_junction (cohort_id, descriptions_id, active, created_at)
        SELECT x.cohort_id, x.descriptions_id, true, NOW()
        FROM params x
        WHERE x.descriptions_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT cohort_descriptions_pkey DO UPDATE SET active = true
    ),
    -- Upsert active flag
    upsert_flag AS (
        INSERT INTO cohort_flags_junction (cohort_id, flags_id, created_at, active)
        SELECT x.cohort_id,
            COALESCE(x.active_flag_id, f.id),
            NOW(),
            true
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.type = 'cohort_active'
        ON CONFLICT ON CONSTRAINT cohort_flags_pkey DO UPDATE SET
            flags_id = COALESCE(EXCLUDED.flags_id, cohort_flags_junction.flags_id),
            active = true
    ),
    -- Link departments
    link_departments AS (
        INSERT INTO cohort_departments_junction (cohort_id, departments_id, active, created_at)
        SELECT x.cohort_id, dept_id, true, NOW()
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) AS dept_id
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT cohort_departments_pkey DO UPDATE SET active = true
    ),
    -- Link simulations
    link_simulations AS (
        INSERT INTO cohort_simulations_junction (cohort_id, simulations_id, active, created_at)
        SELECT x.cohort_id, sim_id, true, NOW()
        FROM params x
        CROSS JOIN UNNEST(x.simulation_ids) AS sim_id
        WHERE COALESCE(array_length(x.simulation_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT cohort_simulations_pkey DO UPDATE SET active = true
    ),
    -- Link simulation positions
    link_simulation_positions AS (
        INSERT INTO cohort_simulation_positions_junction (cohort_id, simulation_positions_id, active, created_at, generated, mcp)
        SELECT x.cohort_id, sp_id, true, NOW(), false, false
        FROM params x
        CROSS JOIN UNNEST(x.simulation_position_ids) AS sp_id
        WHERE COALESCE(array_length(x.simulation_position_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT cohort_simulation_positions_pkey DO UPDATE SET active = true, generated = false, mcp = false
    ),
    -- Link simulation availability
    link_simulation_availability AS (
        INSERT INTO cohort_simulation_availability_junction (cohort_id, simulation_availability_id, active, created_at, generated, mcp)
        SELECT x.cohort_id, sa_id, true, NOW(), false, false
        FROM params x
        CROSS JOIN UNNEST(x.simulation_availability_ids) AS sa_id
        WHERE COALESCE(array_length(x.simulation_availability_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT cohort_simulation_availability_junction_pkey DO UPDATE SET active = true, generated = false, mcp = false
    ),
    -- Link profiles
    link_profiles AS (
        INSERT INTO cohort_profiles_junction (cohort_id, profiles_id, active, created_at, generated, mcp)
        SELECT x.cohort_id, p_id, true, NOW(), false, false
        FROM params x
        CROSS JOIN UNNEST(x.profile_ids) AS p_id
        WHERE COALESCE(array_length(x.profile_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT cohort_profiles_junction_pkey DO UPDATE SET active = true, generated = false, mcp = false
    ),
    -- Link profile personas
    link_profile_personas AS (
        INSERT INTO cohort_profile_personas_junction (cohort_id, profile_personas_id, active, created_at, generated, mcp)
        SELECT x.cohort_id, pp_id, true, NOW(), false, false
        FROM params x
        CROSS JOIN UNNEST(x.profile_persona_ids) AS pp_id
        WHERE COALESCE(array_length(x.profile_persona_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT cohort_profile_personas_junction_pkey DO UPDATE SET active = true, generated = false, mcp = false
    ),
    -- Deactivate old cohorts_resource link
    deactivate_old_resource AS (
        UPDATE cohort_cohorts_junction
        SET active = false
        FROM params p
        WHERE cohort_cohorts_junction.cohort_id = p.cohort_id
          AND cohort_cohorts_junction.active = true
    ),
    -- Link new cohorts_resource
    link_new_resource AS (
        INSERT INTO cohort_cohorts_junction (cohort_id, cohorts_id, active)
        SELECT x.cohort_id, x.cohorts_resource_id, true
        FROM params x
        WHERE x.cohorts_resource_id IS NOT NULL
    )
    SELECT x.cohort_id AS cohort_id
    FROM params x;
END;
$$;
