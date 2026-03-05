-- Unified save eval function (ID-first, section-action compatible)
-- Post-migration 18: runs/groups are runtime-only; evals have direct rubrics + judge models

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

-- Clean up old composite types that no longer exist
DO $$
BEGIN
    DROP TYPE IF EXISTS types.q_save_eval_v4_run_rubric_link;
    DROP TYPE IF EXISTS types.q_save_eval_v4_group_rubric_link;
END $$;

CREATE OR REPLACE FUNCTION api_save_eval_v4(
    profile_id uuid,
    group_id uuid,
    input_eval_id uuid DEFAULT NULL,
    names_id uuid DEFAULT NULL,
    descriptions_id uuid DEFAULT NULL,
    flag_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    rubric_ids uuid[] DEFAULT ARRAY[]::uuid[],
    model_ids uuid[] DEFAULT ARRAY[]::uuid[],
    model_flag_ids uuid[] DEFAULT ARRAY[]::uuid[],
    model_rubric_ids uuid[] DEFAULT ARRAY[]::uuid[],
    model_position_ids uuid[] DEFAULT ARRAY[]::uuid[]
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
    IF names_id IS NULL THEN
        RAISE EXCEPTION 'names_id is required';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM names_resource WHERE id = names_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', names_id;
    END IF;

    IF descriptions_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM descriptions_resource WHERE id = descriptions_id
    ) THEN
        RAISE EXCEPTION 'Description resource not found: %', descriptions_id;
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
        DELETE FROM eval_rubrics_junction WHERE eval_id = v_eval_id;
        DELETE FROM eval_models_junction WHERE eval_id = v_eval_id;
        DELETE FROM eval_model_flags_junction WHERE eval_id = v_eval_id;
        DELETE FROM eval_model_rubrics_junction WHERE eval_id = v_eval_id;
        DELETE FROM eval_model_positions_junction WHERE eval_id = v_eval_id;
    END IF;

    INSERT INTO eval_names_junction (eval_id, names_id, created_at)
    VALUES (v_eval_id, names_id, NOW())
    ON CONFLICT ON CONSTRAINT eval_names_pkey DO UPDATE
    SET active = TRUE;

    IF descriptions_id IS NOT NULL THEN
        INSERT INTO eval_descriptions_junction (eval_id, descriptions_id, created_at)
        VALUES (v_eval_id, descriptions_id, NOW())
        ON CONFLICT ON CONSTRAINT eval_descriptions_pkey DO UPDATE
        SET active = TRUE;
    END IF;

    -- Persist all known eval flags.
    INSERT INTO eval_flags_junction (eval_id, flags_id, created_at)
    SELECT
        v_eval_id,
        f.id,
        NOW()
    FROM flags_resource f
    WHERE f.name IN ('eval_active', 'dynamic', '')
      AND f.id = ANY(COALESCE(flag_ids, ARRAY[]::uuid[]))
    ON CONFLICT ON CONSTRAINT eval_flags_pkey DO UPDATE
    SET active = TRUE;

    INSERT INTO eval_departments_junction (eval_id, departments_id, active, created_at)
    SELECT v_eval_id, dept_id, TRUE, NOW()
    FROM UNNEST(COALESCE(department_ids, ARRAY[]::uuid[])) AS dept_id
    ON CONFLICT ON CONSTRAINT eval_departments_pkey DO UPDATE
    SET active = TRUE;

    -- Direct eval → rubric links (replaces run/group-scoped rubrics)
    INSERT INTO eval_rubrics_junction (eval_id, rubrics_id, active, created_at)
    SELECT v_eval_id, r_id, TRUE, NOW()
    FROM UNNEST(COALESCE(rubric_ids, ARRAY[]::uuid[])) AS r_id
    ON CONFLICT ON CONSTRAINT eval_rubrics_junction_pkey DO UPDATE
    SET active = TRUE;

    -- Direct eval → judge model links
    INSERT INTO eval_models_junction (eval_id, models_id, active, created_at)
    SELECT v_eval_id, m_id, TRUE, NOW()
    FROM UNNEST(COALESCE(model_ids, ARRAY[]::uuid[])) AS m_id
    ON CONFLICT ON CONSTRAINT eval_models_junction_pkey DO UPDATE
    SET active = TRUE;

    -- Model flag junctions
    INSERT INTO eval_model_flags_junction (eval_id, model_flags_id, active, created_at)
    SELECT v_eval_id, mf_id, TRUE, NOW()
    FROM UNNEST(COALESCE(model_flag_ids, ARRAY[]::uuid[])) AS mf_id
    ON CONFLICT ON CONSTRAINT eval_model_flags_junction_pkey DO UPDATE
    SET active = TRUE;

    -- Model rubric junctions
    INSERT INTO eval_model_rubrics_junction (eval_id, model_rubrics_id, active, created_at)
    SELECT v_eval_id, mr_id, TRUE, NOW()
    FROM UNNEST(COALESCE(model_rubric_ids, ARRAY[]::uuid[])) AS mr_id
    ON CONFLICT ON CONSTRAINT eval_model_rubrics_junction_pkey DO UPDATE
    SET active = TRUE;

    -- Model position junctions
    INSERT INTO eval_model_positions_junction (eval_id, model_positions_id, active, created_at)
    SELECT v_eval_id, mp_id, TRUE, NOW()
    FROM UNNEST(COALESCE(model_position_ids, ARRAY[]::uuid[])) AS mp_id
    ON CONFLICT ON CONSTRAINT eval_model_positions_junction_pkey DO UPDATE
    SET active = TRUE;

    -- Keep evals_resource synced for view layers that depend on it.
    SELECT eej.evals_id
    INTO v_evals_id
    FROM eval_evals_junction eej
    WHERE eej.eval_id = v_eval_id
    ORDER BY eej.created_at DESC
    LIMIT 1;

    IF v_evals_id IS NULL THEN
        INSERT INTO evals_resource (group_id, name, description, department_ids, model_ids, model_rubric_ids, model_flag_ids, model_position_ids, active, generated, mcp)
        VALUES (api_save_eval_v4.group_id, NULL, NULL, COALESCE(api_save_eval_v4.department_ids, ARRAY[]::uuid[]), COALESCE(api_save_eval_v4.model_ids, ARRAY[]::uuid[]), COALESCE(api_save_eval_v4.model_rubric_ids, ARRAY[]::uuid[]), COALESCE(api_save_eval_v4.model_flag_ids, ARRAY[]::uuid[]), COALESCE(api_save_eval_v4.model_position_ids, ARRAY[]::uuid[]), TRUE, FALSE, FALSE)
        RETURNING id INTO v_evals_id;

        INSERT INTO eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp)
        VALUES (v_eval_id, v_evals_id, TRUE, NOW(), FALSE, FALSE)
        ON CONFLICT DO NOTHING;
    ELSE
        UPDATE evals_resource
        SET group_id = api_save_eval_v4.group_id,
            department_ids = COALESCE(api_save_eval_v4.department_ids, ARRAY[]::uuid[]),
            model_ids = COALESCE(api_save_eval_v4.model_ids, ARRAY[]::uuid[]),
            model_rubric_ids = COALESCE(api_save_eval_v4.model_rubric_ids, ARRAY[]::uuid[]),
            model_flag_ids = COALESCE(api_save_eval_v4.model_flag_ids, ARRAY[]::uuid[]),
            model_position_ids = COALESCE(api_save_eval_v4.model_position_ids, ARRAY[]::uuid[])
        WHERE id = v_evals_id;
    END IF;

    RETURN QUERY SELECT v_eval_id;
END;
$$;
