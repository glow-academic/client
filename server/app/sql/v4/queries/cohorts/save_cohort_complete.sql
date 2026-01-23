-- Unified save cohort function - draft-first for create/update
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
        WHERE proname = 'api_save_cohort_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_cohort_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_save_cohort_v4(
    draft_id uuid,
    profile_id uuid,
    input_cohort_id uuid DEFAULT NULL
)
RETURNS TABLE (
    cohort_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_cohort_id uuid;
    v_default_call_id uuid;
    v_group_id uuid;
    v_draft_profile_id uuid;
    v_draft_id uuid;
    v_profile_id uuid;
    v_input_cohort_id uuid;
    v_name_id uuid;
    v_description_id uuid;
    v_active_flag_id uuid;
    v_department_ids uuid[];
    v_simulation_ids uuid[];
    is_create boolean;
BEGIN
    v_draft_id := draft_id;
    v_profile_id := profile_id;
    v_input_cohort_id := input_cohort_id;

    IF v_draft_id IS NULL THEN
        RAISE EXCEPTION 'Draft ID is required';
    END IF;

    SELECT d.profile_id, d.group_id
    INTO v_draft_profile_id, v_group_id
    FROM drafts_entry d
    WHERE d.id = v_draft_id;

    IF v_draft_profile_id IS NULL THEN
        RAISE EXCEPTION 'Draft not found: %', v_draft_id;
    END IF;

    IF v_draft_profile_id <> v_profile_id THEN
        RAISE EXCEPTION 'Draft does not belong to profile';
    END IF;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'Draft group_id not found: %', v_draft_id;
    END IF;

    -- Load draft resources (single-select + arrays)
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

    SELECT COALESCE(ARRAY_AGG(ddp.departments_id ORDER BY ddp.created_at), ARRAY[]::uuid[])
    INTO v_department_ids
    FROM departments_draft ddp
    WHERE ddp.draft_id = v_draft_id;

    SELECT COALESCE(ARRAY_AGG(ds.simulations_id ORDER BY ds.created_at), ARRAY[]::uuid[])
    INTO v_simulation_ids
    FROM simulations_draft ds
    WHERE ds.draft_id = v_draft_id;

    -- Validate required resource IDs exist
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

    SELECT id INTO v_default_call_id FROM calls_entry LIMIT 1;
    IF v_default_call_id IS NULL THEN
        RAISE EXCEPTION 'No call_id found for simulation_positions_resource inserts';
    END IF;

    -- Determine if create or update
    is_create := (v_input_cohort_id IS NULL);

    -- Create or UPDATE cohort_artifact first (outside CTE)
    IF is_create THEN
        INSERT INTO cohort_artifact (group_id, created_at, updated_at)
        VALUES (v_group_id, NOW(), NOW())
        RETURNING id INTO v_cohort_id;
    ELSE
        v_cohort_id := v_input_cohort_id;
        UPDATE cohort_artifact
        SET updated_at = NOW(),
            group_id = v_group_id
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
            COALESCE(v_department_ids, ARRAY[]::uuid[]) AS department_ids,
            COALESCE(v_simulation_ids, ARRAY[]::uuid[]) AS simulation_ids,
            v_profile_id AS profile_id,
            v_draft_id AS draft_id,
            v_default_call_id AS default_call_id
    ),
    department_resource_ids AS (
        SELECT
            dept_id,
            COALESCE(dr_by_id.id, dr_by_artifact.id) AS department_resource_id
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) AS dept_id
        LEFT JOIN departments_resource dr_by_id ON dr_by_id.id = dept_id
        LEFT JOIN departments_resource dr_by_artifact ON dr_by_artifact.department_id = dept_id
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
            p.profile_id,
            p.draft_id,
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
    simulation_positions_draft_data AS (
        SELECT
            dsp.simulation_id,
            dsp.value
        FROM params_with_departments x
        JOIN simulation_positions_draft dsp ON dsp.draft_id = x.draft_id
    ),
    -- Simulations with implicit ordering (positions stored separately)
    simulations_with_order AS (
        SELECT 
            dsp.simulation_id as sim_id,
            dsp.value as position
        FROM simulation_positions_draft_data dsp
        UNION ALL
        SELECT 
            sim_list.sim_id,
            sim_list.ordinality as position
        FROM params_with_departments x
        CROSS JOIN UNNEST(x.simulation_ids) WITH ORDINALITY AS sim_list(sim_id, ordinality)
        WHERE NOT EXISTS (SELECT 1 FROM simulation_positions_draft_data)
          AND COALESCE(array_length(x.simulation_ids, 1), 0) > 0
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
    )
    SELECT 
        x.cohort_id AS cohort_id,
        ap.actor_name AS actor_name
    FROM params_with_departments x
    CROSS JOIN actor_profile ap;
END;
$$;
