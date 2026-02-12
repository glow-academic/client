-- Unified save eval function (ID-first, section-action compatible)

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_save_eval_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_eval_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS types.q_save_eval_v4_run_rubric_link;
    DROP TYPE IF EXISTS types.q_save_eval_v4_group_rubric_link;
END $$;

CREATE TYPE types.q_save_eval_v4_run_rubric_link AS (
    run_id uuid,
    rubric_ids uuid[]
);

CREATE TYPE types.q_save_eval_v4_group_rubric_link AS (
    group_id uuid,
    rubric_ids uuid[]
);

CREATE OR REPLACE FUNCTION api_save_eval_v4(
    profile_id uuid,
    group_id uuid,
    input_eval_id uuid DEFAULT NULL,
    name_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
    flag_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    agent_ids uuid[] DEFAULT ARRAY[]::uuid[],
    model_run_ids uuid[] DEFAULT ARRAY[]::uuid[],
    group_ids uuid[] DEFAULT ARRAY[]::uuid[],
    run_position_ids uuid[] DEFAULT ARRAY[]::uuid[],
    group_position_ids uuid[] DEFAULT ARRAY[]::uuid[],
    run_rubric_links types.q_save_eval_v4_run_rubric_link[] DEFAULT ARRAY[]::types.q_save_eval_v4_run_rubric_link[],
    group_rubric_links types.q_save_eval_v4_group_rubric_link[] DEFAULT ARRAY[]::types.q_save_eval_v4_group_rubric_link[]
)
RETURNS TABLE (
    eval_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_eval_id uuid;
    v_evals_id uuid;
    v_is_create boolean;
BEGIN
    IF name_id IS NULL THEN
        RAISE EXCEPTION 'name_id is required';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM names_resource WHERE id = name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', name_id;
    END IF;

    IF description_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM descriptions_resource WHERE id = description_id
    ) THEN
        RAISE EXCEPTION 'Description resource not found: %', description_id;
    END IF;

    v_is_create := (input_eval_id IS NULL);

    IF v_is_create THEN
        INSERT INTO eval_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_eval_id;
    ELSE
        v_eval_id := input_eval_id;
        UPDATE eval_artifact
        SET updated_at = NOW()
        WHERE id = v_eval_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Eval not found: %', v_eval_id;
        END IF;

        DELETE FROM eval_names_junction WHERE eval_id = v_eval_id;
        DELETE FROM eval_descriptions_junction WHERE eval_id = v_eval_id;
        DELETE FROM eval_flags_junction WHERE eval_id = v_eval_id;
        DELETE FROM eval_departments_junction WHERE eval_id = v_eval_id;
        DELETE FROM eval_agents_junction WHERE eval_id = v_eval_id;
        DELETE FROM eval_runs_junction WHERE eval_id = v_eval_id;
        DELETE FROM eval_groups_junction WHERE eval_id = v_eval_id;
        DELETE FROM eval_run_positions_junction WHERE eval_id = v_eval_id;
        DELETE FROM eval_group_positions_junction WHERE eval_id = v_eval_id;
        DELETE FROM eval_runs_rubrics_junction WHERE eval_id = v_eval_id;
        DELETE FROM eval_groups_rubrics_junction WHERE eval_id = v_eval_id;
    END IF;

    INSERT INTO eval_names_junction (eval_id, name_id, created_at)
    VALUES (v_eval_id, name_id, NOW())
    ON CONFLICT ON CONSTRAINT eval_names_pkey DO UPDATE
    SET active = TRUE;

    IF description_id IS NOT NULL THEN
        INSERT INTO eval_descriptions_junction (eval_id, description_id, created_at)
        VALUES (v_eval_id, description_id, NOW())
        ON CONFLICT ON CONSTRAINT eval_descriptions_pkey DO UPDATE
        SET active = TRUE;
    END IF;

    -- Persist all known eval flags with explicit boolean values.
    INSERT INTO eval_flags_junction (eval_id, flag_id, value, created_at)
    SELECT
        v_eval_id,
        f.id,
        f.id = ANY(COALESCE(flag_ids, ARRAY[]::uuid[])),
        NOW()
    FROM flags_resource f
    WHERE f.name IN ('eval_active', 'dynamic', '')
    ON CONFLICT ON CONSTRAINT eval_flags_pkey DO UPDATE
    SET value = EXCLUDED.value,
        active = TRUE;

    INSERT INTO eval_departments_junction (eval_id, department_id, active, created_at)
    SELECT v_eval_id, dept_id, TRUE, NOW()
    FROM UNNEST(COALESCE(department_ids, ARRAY[]::uuid[])) AS dept_id
    ON CONFLICT ON CONSTRAINT eval_departments_pkey DO UPDATE
    SET active = TRUE;

    INSERT INTO eval_agents_junction (eval_id, agent_id, created_at)
    SELECT v_eval_id, agent_id, NOW()
    FROM UNNEST(COALESCE(agent_ids, ARRAY[]::uuid[])) AS agent_id
    ON CONFLICT ON CONSTRAINT eval_agents_pkey DO UPDATE
    SET active = TRUE;

    INSERT INTO eval_runs_junction (eval_id, run_id, completed, created_at)
    SELECT v_eval_id, run_id, FALSE, NOW()
    FROM UNNEST(COALESCE(model_run_ids, ARRAY[]::uuid[])) AS run_id
    ON CONFLICT ON CONSTRAINT eval_runs_pkey DO UPDATE
    SET active = TRUE,
        completed = FALSE;

    INSERT INTO eval_groups_junction (eval_id, group_id, created_at)
    SELECT v_eval_id, grp_id, NOW()
    FROM UNNEST(COALESCE(group_ids, ARRAY[]::uuid[])) AS grp_id
    ON CONFLICT ON CONSTRAINT eval_groups_pkey DO UPDATE
    SET active = TRUE;

    INSERT INTO eval_run_positions_junction (eval_id, run_positions_id, created_at)
    SELECT v_eval_id, rp_id, NOW()
    FROM UNNEST(COALESCE(run_position_ids, ARRAY[]::uuid[])) AS rp_id
    ON CONFLICT ON CONSTRAINT eval_run_positions_pkey DO UPDATE
    SET active = TRUE;

    INSERT INTO eval_group_positions_junction (eval_id, group_positions_id, created_at)
    SELECT v_eval_id, gp_id, NOW()
    FROM UNNEST(COALESCE(group_position_ids, ARRAY[]::uuid[])) AS gp_id
    ON CONFLICT ON CONSTRAINT eval_group_positions_pkey DO UPDATE
    SET active = TRUE;

    WITH created_run_rubrics AS (
        INSERT INTO run_rubrics_resource (runs_id, rubric_id, created_at, generated, mcp, active)
        SELECT DISTINCT rr.run_id, rubric_id, NOW(), FALSE, FALSE, TRUE
        FROM UNNEST(COALESCE(run_rubric_links, ARRAY[]::types.q_save_eval_v4_run_rubric_link[])) AS rr
        CROSS JOIN LATERAL UNNEST(COALESCE(rr.rubric_ids, ARRAY[]::uuid[])) AS rubric_id
        ON CONFLICT (runs_id, rubric_id) DO UPDATE
        SET active = TRUE
        RETURNING id
    )
    INSERT INTO eval_runs_rubrics_junction (eval_id, run_rubric_id, created_at, generated, mcp, active)
    SELECT v_eval_id, crr.id, NOW(), FALSE, FALSE, TRUE
    FROM created_run_rubrics crr
    ON CONFLICT ON CONSTRAINT eval_runs_rubrics_junction_pkey DO UPDATE
    SET active = TRUE;

    WITH created_group_rubrics AS (
        INSERT INTO group_rubrics_resource (groups_id, rubric_id, created_at, generated, mcp, active)
        SELECT DISTINCT gr.group_id, rubric_id, NOW(), FALSE, FALSE, TRUE
        FROM UNNEST(COALESCE(group_rubric_links, ARRAY[]::types.q_save_eval_v4_group_rubric_link[])) AS gr
        CROSS JOIN LATERAL UNNEST(COALESCE(gr.rubric_ids, ARRAY[]::uuid[])) AS rubric_id
        ON CONFLICT (groups_id, rubric_id) DO UPDATE
        SET active = TRUE
        RETURNING id
    )
    INSERT INTO eval_groups_rubrics_junction (eval_id, group_rubric_id, created_at, generated, mcp, active)
    SELECT v_eval_id, cgr.id, NOW(), FALSE, FALSE, TRUE
    FROM created_group_rubrics cgr
    ON CONFLICT ON CONSTRAINT eval_groups_rubrics_junction_pkey DO UPDATE
    SET active = TRUE;

    -- Keep evals_resource synced for view layers that depend on it.
    SELECT eej.evals_id
    INTO v_evals_id
    FROM eval_evals_junction eej
    WHERE eej.eval_id = v_eval_id
    ORDER BY eej.created_at DESC
    LIMIT 1;

    IF v_evals_id IS NULL THEN
        INSERT INTO evals_resource (group_id, name, description, department_ids, active, generated, mcp)
        VALUES (api_save_eval_v4.group_id, NULL, NULL, COALESCE(api_save_eval_v4.department_ids, ARRAY[]::uuid[]), TRUE, FALSE, FALSE)
        RETURNING id INTO v_evals_id;

        INSERT INTO eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp)
        VALUES (v_eval_id, v_evals_id, TRUE, NOW(), FALSE, FALSE)
        ON CONFLICT DO NOTHING;
    ELSE
        UPDATE evals_resource
        SET group_id = api_save_eval_v4.group_id,
            department_ids = COALESCE(api_save_eval_v4.department_ids, ARRAY[]::uuid[])
        WHERE id = v_evals_id;
    END IF;

    RETURN QUERY SELECT v_eval_id;
END;
$$;

