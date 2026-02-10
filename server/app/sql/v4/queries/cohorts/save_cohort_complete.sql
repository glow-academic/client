-- Unified save cohort function - handles both create (input_cohort_id = NULL) and update (input_cohort_id provided)
-- Accepts form fields directly (no draft_id dependency)

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_save_cohort_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_cohort_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function with direct form data parameters (no draft_id)
CREATE OR REPLACE FUNCTION api_save_cohort_v4(
    profile_id uuid,
    group_id uuid,
    input_cohort_id uuid DEFAULT NULL,
    -- Required form data
    name_id uuid DEFAULT NULL,
    -- Optional single-select form data
    description_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    -- Optional multi-select form data
    department_ids uuid[] DEFAULT NULL,
    simulation_ids uuid[] DEFAULT NULL,
    -- Special: simulation position values for ordering
    simulation_position_values int[] DEFAULT NULL
)
RETURNS TABLE (
    cohort_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_cohort_id uuid;
    v_default_call_id uuid;
    v_group_id uuid;
    v_profile_id uuid;
    v_input_cohort_id uuid;
    v_name_id uuid;
    v_description_id uuid;
    v_active_flag_id uuid;
    v_department_ids uuid[];
    v_simulation_ids uuid[];
    v_simulation_position_values int[];
    is_create boolean;
BEGIN
    -- Assign parameters to local variables
    v_profile_id := profile_id;
    v_group_id := group_id;
    v_input_cohort_id := input_cohort_id;
    v_name_id := name_id;
    v_description_id := description_id;
    v_active_flag_id := active_flag_id;
    v_department_ids := COALESCE(department_ids, ARRAY[]::uuid[]);
    v_simulation_ids := COALESCE(simulation_ids, ARRAY[]::uuid[]);
    v_simulation_position_values := COALESCE(simulation_position_values, ARRAY[]::int[]);

    -- Validate required fields
    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'group_id is required';
    END IF;

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

    IF v_department_ids IS NOT NULL AND EXISTS (
        SELECT 1
        FROM unnest(v_department_ids) AS dept_id
        WHERE NOT EXISTS (
            SELECT 1
            FROM departments_resource dr
            WHERE dr.id = dept_id OR dr.department_id = dept_id
        )
    ) THEN
        RAISE EXCEPTION 'Department resource not found for provided IDs';
    END IF;

    SELECT id INTO v_default_call_id FROM view_calls_entry LIMIT 1;
    IF v_default_call_id IS NULL THEN
        RAISE EXCEPTION 'No call_id found for simulation_positions_resource inserts';
    END IF;

    -- Determine if create or update
    is_create := (v_input_cohort_id IS NULL);

    -- Create or UPDATE cohort_artifact first (outside CTE)
    IF is_create THEN
        INSERT INTO cohort_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_cohort_id;
    ELSE
        v_cohort_id := v_input_cohort_id;
        UPDATE cohort_artifact
        SET updated_at = NOW()
        WHERE id = v_cohort_id;
    END IF;

    -- Conditional: For update, remove old links first (outside CTE since we need PL/pgSQL variable)
    IF NOT is_create THEN
        DELETE FROM cohort_names_junction WHERE cohort_names_junction.cohort_id = v_cohort_id;
        DELETE FROM cohort_descriptions_junction WHERE cohort_descriptions_junction.cohort_id = v_cohort_id;
        DELETE FROM cohort_departments_junction WHERE cohort_departments_junction.cohort_id = v_cohort_id;
        DELETE FROM cohort_simulations_junction WHERE cohort_simulations_junction.cohort_id = v_cohort_id;
        DELETE FROM cohort_simulation_positions_junction WHERE cohort_simulation_positions_junction.cohort_id = v_cohort_id;
        -- Update existing active flag if it exists
        UPDATE cohort_flags_junction SET
            flag_id = COALESCE(v_active_flag_id, cohort_flags_junction.flag_id),
            value = CASE WHEN v_active_flag_id IS NOT NULL THEN true ELSE false END
        WHERE cohort_flags_junction.cohort_id = v_cohort_id;
    END IF;

    -- Continue with cohort save using SQL (cohort already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_cohort_id AS cohort_id,
            v_name_id AS name_id,
            v_description_id AS description_id,
            v_active_flag_id AS active_flag_id,
            v_department_ids AS department_ids,
            v_simulation_ids AS simulation_ids,
            v_simulation_position_values AS simulation_position_values,
            v_profile_id AS profile_id,
            v_default_call_id AS default_call_id
    ),
    department_resource_ids AS (
        SELECT
            dept_id,
            COALESCE(dr_by_id.id, dr_by_artifact.id) AS department_resource_id
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) AS dept_id
        LEFT JOIN departments_resource dr_by_id ON dr_by_id.id = dept_id
        LEFT JOIN department_departments_junction ddj ON ddj.department_id = dept_id
        LEFT JOIN departments_resource dr_by_artifact ON dr_by_artifact.id = ddj.departments_id
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
    ),
    department_resource_ids_agg AS (
        SELECT COALESCE(ARRAY_AGG(DISTINCT department_resource_id), ARRAY[]::uuid[]) AS department_ids
        FROM department_resource_ids
        WHERE department_resource_id IS NOT NULL
    ),
    params_with_departments AS (
        SELECT
            p.cohort_id,
            p.name_id,
            p.description_id,
            p.active_flag_id,
            COALESCE(dra.department_ids, ARRAY[]::uuid[]) AS department_ids,
            p.simulation_ids,
            p.simulation_position_values,
            p.profile_id,
            p.default_call_id
        FROM params p
        CROSS JOIN department_resource_ids_agg dra
    ),
    user_profile AS (
        SELECT role, actor_name
        FROM view_user_profile_context
        WHERE profile_id = (SELECT profile_id FROM params)
    ),
    -- Conditional: Validate permissions based on operation
    object_current_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM cohort_departments_junction
        WHERE cohort_departments_junction.cohort_id = (SELECT p.cohort_id FROM params_with_departments p LIMIT 1) AND active = true
    ),
    user_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM profile_departments_junction
        WHERE profile_departments_junction.profile_id = (SELECT p.profile_id FROM params_with_departments p LIMIT 1) AND active = true
    ),
    validate_permissions AS (
        SELECT
            CASE
                WHEN (SELECT p.cohort_id FROM params_with_departments p) IS NULL THEN
                    -- Validate create permissions
                    (SELECT validate_department_create_permissions(
                        up.role::text,
                        x.department_ids::text[]
                    ) FROM params_with_departments x CROSS JOIN user_profile up)
                ELSE
                    -- Validate update permissions
                    (SELECT validate_department_update_permissions(
                        up.role::text,
                        ocd.department_ids,
                        ud.department_ids
                    ) FROM user_profile up
                    CROSS JOIN object_current_departments ocd
                    CROSS JOIN user_departments ud)
            END as validation_passed
    ),
    actor_profile AS (
        SELECT
            x.profile_id,
            up.actor_name
        FROM params_with_departments x
        CROSS JOIN user_profile up
    ),
    -- Link cohort to name
    link_cohort_name AS (
        INSERT INTO cohort_names_junction (cohort_id, name_id, created_at)
        SELECT
            x.cohort_id,
            x.name_id,
            NOW()
        FROM params_with_departments x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT cohort_names_pkey DO NOTHING
    ),
    -- Link cohort to description
    link_cohort_description AS (
        INSERT INTO cohort_descriptions_junction (cohort_id, description_id, created_at)
        SELECT
            x.cohort_id,
            x.description_id,
            NOW()
        FROM params_with_departments x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT cohort_descriptions_pkey DO NOTHING
    ),
    -- Insert or UPDATE cohort_artifact active flag (UPDATE handled above for update case, INSERT here handles both via ON CONFLICT)
    insert_cohort_active_flag AS (
        INSERT INTO cohort_flags_junction (cohort_id, flag_id, value, created_at) SELECT x.cohort_id,
            COALESCE(x.active_flag_id, f.id),
            CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
            NOW()
        FROM params_with_departments x
        CROSS JOIN flags_resource f
        WHERE f.name = 'cohort_active'
        ON CONFLICT ON CONSTRAINT cohort_flags_pkey DO UPDATE SET
            flag_id = COALESCE(EXCLUDED.flag_id, cohort_flags_junction.flag_id),
            value = EXCLUDED.value
    ),
    -- Link departments (old ones already deleted above if update)
    link_departments AS (
        INSERT INTO cohort_departments_junction (cohort_id, department_id, active, created_at)
        SELECT
            x.cohort_id,
            dri.department_resource_id,
            true,
            NOW()
        FROM params_with_departments x
        JOIN department_resource_ids dri ON dri.department_resource_id IS NOT NULL
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT cohort_departments_pkey DO UPDATE SET
            active = true
    ),
    -- Simulations with positions from form data
    simulations_with_order AS (
        SELECT
            sim_id,
            COALESCE(
                v_simulation_position_values[sim_list.ordinality::int],
                sim_list.ordinality::int
            ) as position
        FROM params_with_departments x
        CROSS JOIN UNNEST(x.simulation_ids) WITH ORDINALITY AS sim_list(sim_id, ordinality)
        WHERE COALESCE(array_length(x.simulation_ids, 1), 0) > 0
    ),
    link_simulations AS (
        INSERT INTO cohort_simulations_junction (cohort_id, simulation_id, active)
        SELECT
            x.cohort_id,
            swo.sim_id,
            true
        FROM params_with_departments x
        CROSS JOIN simulations_with_order swo
        ON CONFLICT ON CONSTRAINT cohort_simulations_pkey DO UPDATE SET
            active = true
    ),
    upsert_simulation_positions AS (
        INSERT INTO simulation_positions_resource (
            simulation_id,
            value,
            created_at,
            generated,
            mcp,
            call_id
        )
        SELECT
            swo.sim_id,
            swo.position,
            NOW(),
            false,
            false,
            x.default_call_id
        FROM params_with_departments x
        CROSS JOIN simulations_with_order swo
        ON CONFLICT (simulation_id, value) DO UPDATE SET created_at = EXCLUDED.created_at
        RETURNING id, simulation_id, value
    ),
    link_simulation_positions AS (
        INSERT INTO cohort_simulation_positions_junction (
            cohort_id,
            simulation_position_id,
            active,
            created_at,
            generated,
            mcp
        )
        SELECT
            x.cohort_id,
            usp.id,
            true,
            NOW(),
            false,
            false
        FROM params_with_departments x
        CROSS JOIN upsert_simulation_positions usp
        ON CONFLICT ON CONSTRAINT cohort_simulation_positions_pkey DO UPDATE SET
            active = true
    ),
    -- Sync linked resources with name/description
    sync_artifact_resources AS (
        UPDATE cohorts_resource r
        SET name = n.name,
            description = d.description
        FROM cohort_cohorts_junction j
        CROSS JOIN params_with_departments p
        LEFT JOIN names_resource n ON n.id = p.name_id
        LEFT JOIN descriptions_resource d ON d.id = p.description_id
        WHERE j.cohorts_id = r.id
          AND j.cohort_id = p.cohort_id
        RETURNING r.id
    )
    SELECT
        x.cohort_id AS cohort_id,
        ap.actor_name AS actor_name
    FROM params_with_departments x
    CROSS JOIN actor_profile ap;
END;
$$;
