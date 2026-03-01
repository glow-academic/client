-- Sync benchmark entries from eval save
-- Creates benchmark_entry → connections → invocation_entry → invocation connections
-- Insert-only. No reads from _entry tables. No deactivation of old entries.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_sync_benchmark_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_sync_benchmark_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop types if exists
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'i_sync_%_v4'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- Input type for model configuration per eval
CREATE TYPE types.i_sync_model_v4 AS (
    resource_id uuid,
    position integer,
    position_resource_ids uuid[],
    rubric_resource_ids uuid[],
    flag_resource_ids uuid[]
);

-- Input type for invocation slot per model
CREATE TYPE types.i_sync_invocation_v4 AS (
    model_index integer,
    model_flag_ids uuid[],
    model_rubric_ids uuid[],
    model_position_ids uuid[]
);

CREATE OR REPLACE FUNCTION api_sync_benchmark_entries_v4(
    evals_resource_id uuid,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    models types.i_sync_model_v4[] DEFAULT ARRAY[]::types.i_sync_model_v4[],
    invocations types.i_sync_invocation_v4[] DEFAULT ARRAY[]::types.i_sync_invocation_v4[]
)
RETURNS TABLE (
    entry_count integer
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_benchmark_id uuid;
    v_invocation_id uuid;
    v_model types.i_sync_model_v4;
    v_invocation types.i_sync_invocation_v4;
    v_count integer := 0;
    v_model_resource_id uuid;
BEGIN
    -- Create benchmark_entry
    INSERT INTO benchmark_entry (created_at, updated_at, active)
    VALUES (NOW(), NOW(), TRUE)
    RETURNING id INTO v_benchmark_id;

    -- benchmark_evals_connection
    INSERT INTO benchmark_evals_connection (benchmark_id, evals_id, created_at, active)
    VALUES (v_benchmark_id, evals_resource_id, NOW(), TRUE);

    -- benchmark_departments_connection
    INSERT INTO benchmark_departments_connection (benchmark_id, departments_id, created_at, active)
    SELECT v_benchmark_id, dept_id, NOW(), TRUE
    FROM UNNEST(COALESCE(department_ids, ARRAY[]::uuid[])) AS dept_id;

    -- Create invocation_entry per invocation slot
    FOREACH v_invocation IN ARRAY COALESCE(invocations, ARRAY[]::types.i_sync_invocation_v4[])
    LOOP
        INSERT INTO invocation_entry (benchmark_id, created_at, updated_at, active)
        VALUES (v_benchmark_id, NOW(), NOW(), TRUE)
        RETURNING id INTO v_invocation_id;

        -- Resolve model from index
        IF v_invocation.model_index > 0 AND v_invocation.model_index <= array_length(models, 1) THEN
            v_model := models[v_invocation.model_index];
            v_model_resource_id := v_model.resource_id;

            -- invocation_models_connection
            IF v_model_resource_id IS NOT NULL THEN
                INSERT INTO invocation_models_connection (invocation_id, models_id, created_at, active)
                VALUES (v_invocation_id, v_model_resource_id, NOW(), TRUE);
            END IF;
        END IF;

        -- invocation_model_flags_connection
        INSERT INTO invocation_model_flags_connection (invocation_id, model_flags_id, created_at, active)
        SELECT v_invocation_id, mf_id, NOW(), TRUE
        FROM UNNEST(COALESCE(v_invocation.model_flag_ids, ARRAY[]::uuid[])) AS mf_id;

        -- invocation_model_rubrics_connection
        INSERT INTO invocation_model_rubrics_connection (invocation_id, model_rubrics_id, created_at, active)
        SELECT v_invocation_id, mr_id, NOW(), TRUE
        FROM UNNEST(COALESCE(v_invocation.model_rubric_ids, ARRAY[]::uuid[])) AS mr_id;

        -- invocation_model_positions_connection
        INSERT INTO invocation_model_positions_connection (invocation_id, model_positions_id, created_at, active)
        SELECT v_invocation_id, mp_id, NOW(), TRUE
        FROM UNNEST(COALESCE(v_invocation.model_position_ids, ARRAY[]::uuid[])) AS mp_id;

        v_count := v_count + 1;
    END LOOP;

    RETURN QUERY SELECT v_count;
END;
$$;
