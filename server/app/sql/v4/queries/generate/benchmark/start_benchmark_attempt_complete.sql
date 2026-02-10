-- Start benchmark attempt: creates test invocations and links to runs/groups
-- Returns attempt_id, eval_id, use_groups, and invocation list (as chats for compatibility)

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_start_benchmark_attempt_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_start_benchmark_attempt_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_start_benchmark_attempt_v4(
    p_profile_id uuid,
    p_eval_id uuid,
    p_infinite_mode boolean DEFAULT false
)
RETURNS TABLE (
    attempt_id uuid,
    eval_id uuid,
    use_groups boolean,
    chats jsonb
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_attempt_id uuid;
    v_use_groups boolean;
    v_chats jsonb := '[]'::jsonb;
    v_run RECORD;
    v_group RECORD;
    v_chat_id uuid;
    v_first_group_id uuid;
    v_run_resource_id uuid;
    v_total_runs integer;
    v_profiles_resource_id uuid;
BEGIN
    -- Validate eval exists
    IF NOT EXISTS (SELECT 1 FROM eval_artifact WHERE id = p_eval_id) THEN
        RETURN QUERY SELECT NULL::uuid, NULL::uuid, false, '[]'::jsonb;
        RETURN;
    END IF;

    -- Resolve profile_artifact ID → profiles_resource ID
    SELECT ppj.profiles_id INTO v_profiles_resource_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = p_profile_id AND ppj.active = true
    LIMIT 1;

    IF v_profiles_resource_id IS NULL THEN
        RAISE EXCEPTION 'Profile resource not found for profile_id %', p_profile_id;
    END IF;

    -- Determine if eval uses groups or individual runs
    v_use_groups := EXISTS (
        SELECT 1 FROM eval_groups_junction egj WHERE egj.eval_id = p_eval_id AND egj.active = true
    );

    -- Create benchmark_tests_entry (test)
    INSERT INTO benchmark_tests_entry (infinite_mode, generated, mcp, created_at, updated_at)
    VALUES (p_infinite_mode, false, false, NOW(), NOW())
    RETURNING id INTO v_attempt_id;

    -- Link attempt to profile (using resource ID)
    INSERT INTO benchmark_tests_profiles_connection (attempt_id, profiles_id, active)
    VALUES (v_attempt_id, v_profiles_resource_id, true);

    -- Link attempt to eval
    INSERT INTO benchmark_tests_evals_connection (attempt_id, eval_id, active)
    VALUES (v_attempt_id, p_eval_id, true);

    IF v_use_groups THEN
        -- Create invocation for each group
        FOR v_group IN
            SELECT
                egj.group_id as groups_resource_id
            FROM eval_groups_junction egj
            WHERE egj.eval_id = p_eval_id AND egj.active = true
            ORDER BY egj.created_at
        LOOP
            -- Create invocation
            INSERT INTO benchmark_invocations_entry (test_id, title, generated, mcp, created_at, updated_at)
            VALUES (v_attempt_id, '', false, false, NOW(), NOW())
            RETURNING id INTO v_chat_id;

            -- Set group_id directly on invocation from groups_entry
            SELECT ggc.group_id INTO v_first_group_id
            FROM groups_groups_connection ggc
            WHERE ggc.groups_id = v_group.groups_resource_id AND ggc.active = true
            LIMIT 1;

            UPDATE benchmark_invocations_entry SET group_id = v_first_group_id WHERE id = v_chat_id;

            -- Link invocation to source groups_resource
            INSERT INTO benchmark_invocations_groups_connection (invocation_id, groups_id, active)
            VALUES (v_chat_id, v_group.groups_resource_id, true)
            ON CONFLICT (invocation_id, groups_id) DO NOTHING;

            IF v_first_group_id IS NOT NULL THEN
                -- Link all runs_resource from runs_entry belonging to this group
                INSERT INTO benchmark_invocations_runs_connection (invocation_id, runs_id, active)
                SELECT DISTINCT v_chat_id, rrc.runs_id, true
                FROM runs_entry re
                JOIN runs_runs_connection rrc ON rrc.run_id = re.id AND rrc.active = true
                WHERE re.group_id = v_first_group_id
                ORDER BY rrc.runs_id;

                -- Count total runs
                SELECT COUNT(DISTINCT rrc.runs_id) INTO v_total_runs
                FROM runs_entry re
                JOIN runs_runs_connection rrc ON rrc.run_id = re.id AND rrc.active = true
                WHERE re.group_id = v_first_group_id;
            ELSE
                v_total_runs := 0;
            END IF;

            -- Add to output array (chat_id key preserved for compatibility)
            v_chats := v_chats || jsonb_build_object(
                'chat_id', v_chat_id,
                'run_resource_id', NULL,
                'group_resource_id', v_group.groups_resource_id,
                'total_runs', COALESCE(v_total_runs, 0)
            );
        END LOOP;
    ELSE
        -- Create invocation for each run
        FOR v_run IN
            SELECT
                erj.run_id as runs_resource_id
            FROM eval_runs_junction erj
            WHERE erj.eval_id = p_eval_id AND erj.active = true
            ORDER BY erj.created_at
        LOOP
            -- Create invocation
            INSERT INTO benchmark_invocations_entry (test_id, title, generated, mcp, created_at, updated_at)
            VALUES (v_attempt_id, '', false, false, NOW(), NOW())
            RETURNING id INTO v_chat_id;

            -- Link invocation to runs_resource
            INSERT INTO benchmark_invocations_runs_connection (invocation_id, runs_id, active)
            VALUES (v_chat_id, v_run.runs_resource_id, true);

            -- Set group_id on chat from runs_resource's linked runs_entry
            SELECT re.group_id INTO v_first_group_id
            FROM runs_runs_connection rrc
            JOIN runs_entry re ON re.id = rrc.run_id
            WHERE rrc.runs_id = v_run.runs_resource_id AND rrc.active = true
            LIMIT 1;

            IF v_first_group_id IS NOT NULL THEN
                UPDATE benchmark_invocations_entry SET group_id = v_first_group_id WHERE id = v_chat_id;

                -- Link invocation to source groups_resource if resolvable
                INSERT INTO benchmark_invocations_groups_connection (invocation_id, groups_id, active)
                SELECT v_chat_id, ggc.groups_id, true
                FROM groups_groups_connection ggc
                WHERE ggc.group_id = v_first_group_id
                  AND ggc.active = true
                ON CONFLICT (invocation_id, groups_id) DO NOTHING;
            END IF;

            -- Add to chats array
            v_chats := v_chats || jsonb_build_object(
                'chat_id', v_chat_id,
                'run_resource_id', v_run.runs_resource_id,
                'group_resource_id', NULL,
                'total_runs', 1
            );
        END LOOP;
    END IF;

    RETURN QUERY SELECT v_attempt_id, p_eval_id, v_use_groups, v_chats;
END;
$$;
